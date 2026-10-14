import type { Master, MasterSection, Resume, ResumeMeta } from '../types';
import { COUNTRIES, DEFAULT_KINDS, HEADER_FIELDS, KINDS, TEMPLATES } from './constants';
import { fmtDateField } from './dates';
import { CLIENT_ID, clone, nowISO, str, uid } from './util';

/* ---------- master / resume construction ---------- */
export function makeSection(kind: string, title?: string): MasterSection {
  const k = KINDS[kind] || KINDS.custom;
  return { id: uid('s_'), kind, title: title || k.title, display: k.display, fields: clone(k.fields), items: [], defaultVisible: true };
}
export function emptyMaster(): Master {
  return { v: 1, header: { values: { fullName: '', headline: '', email: '', phone: '', location: '' }, links: [], extra: [] }, sections: DEFAULT_KINDS.map((k) => makeSection(k)), updated: nowISO(), rev: 0, by: CLIENT_ID };
}
export function masterIsEmpty(m) {
  return !m || (!m.header.values.fullName && m.sections.every((s) => !s.items.length));
}
export function blankItem(section) { const v = {}; section.fields.forEach((f) => { v[f.key] = defaultValue(f); }); return { id: uid('i_'), v }; }
export function defaultValue(f) { return f.type === 'bullets' || f.type === 'tags' ? [] : f.type === 'daterange' ? { s: '', e: '', cur: false } : ''; }

export function newResume(master: Master, meta: Partial<ResumeMeta> & { name?: string }, templateId?: string): Resume {
  const T = TEMPLATES[templateId] || TEMPLATES.classic;
  const c = COUNTRIES[meta.country] || COUNTRIES.Other;
  const sections = master.sections.map((s) => ({
    id: uid('r_'), ref: s.id, title: null, visible: s.defaultVisible !== false && (s.items.length > 0 || true), fieldHide: {},
    items: s.items.map((it, i) => ({ id: uid('x_'), ref: it.id, visible: s.kind === 'summary' ? i === 0 : true, ov: {} })),
  }));
  return {
    v: 1, id: uid('res_'), name: meta.name || 'Untitled resume', status: 'draft',
    meta: { jobTitle: meta.jobTitle || '', company: meta.company || '', country: meta.country || 'Other', language: meta.language || 'en', industry: meta.industry || '', tags: meta.tags || [], notes: '', jobUrl: '', jobDescription: '' },
    template: templateId in TEMPLATES ? templateId : 'classic',
    layout: { ...T.preset, pageSize: c.page, dateFormat: c.date },
    header: { ov: {}, hide: {}, hiddenLinks: [], hiddenExtra: [] },
    sections, created: nowISO(), updated: nowISO(), rev: 0, by: CLIENT_ID, vcount: 0,
  };
}
export function duplicateResume(r: Resume, name?: string): Resume {
  const c = clone(r);
  c.id = uid('res_'); c.name = name || ('Copy of ' + r.name); c.status = 'draft'; c.created = nowISO(); c.updated = nowISO(); c.rev = 0; c.vcount = 0; c.by = CLIENT_ID;
  c.sections.forEach((s) => { s.id = uid('r_'); s.items.forEach((i) => { i.id = uid('x_'); }); });
  return c;
}

/* ---------- resolver: master + resume overrides -> concrete values ---------- */
export function resolve(master, resume) {
  const hv = { ...master.header.values, ...(resume.header.ov || {}) };
  const header = {
    values: hv,
    links: master.header.links.map((l) => ({ ...l, hidden: (resume.header.hiddenLinks || []).includes(l.id) })),
    extra: master.header.extra.map((l) => ({ ...l, hidden: (resume.header.hiddenExtra || []).includes(l.id) })),
    hide: resume.header.hide || {}, ovKeys: Object.keys(resume.header.ov || {}),
  };
  const sections = [];
  for (const rs of resume.sections) {
    const ms = rs.local ? rs : master.sections.find((s) => s.id === rs.ref);
    if (!ms) continue;
    const items = [];
    for (const ri of rs.items) {
      let v; let ov = [];
      if (ri.local) v = ri.v || {};
      else {
        const mi = ms.items.find((i) => i.id === ri.ref);
        if (!mi) continue;
        v = { ...mi.v, ...(ri.ov || {}) }; ov = Object.keys(ri.ov || {});
      }
      items.push({ id: ri.id, ri, v, ov, local: !!ri.local, visible: ri.visible !== false });
    }
    const unused = rs.local ? [] : ms.items.filter((mi) => !rs.items.some((ri) => ri.ref === mi.id));
    sections.push({ id: rs.id, rs, ms, kind: ms.kind, title: rs.title != null && rs.title !== '' ? rs.title : ms.title, titleOv: rs.title != null && rs.title !== '', display: rs.display || ms.display, fields: ms.fields, hiddenFields: rs.fieldHide || {}, items, unused, visible: rs.visible !== false, local: !!rs.local, col: rs.col === 'side' ? 'side' : 'main' });
  }
  const availableSections = master.sections.filter((s) => !resume.sections.some((rs) => rs.ref === s.id));
  return { header, sections, availableSections };
}
export function countOverrides(master, resume) {
  let n = Object.keys(resume.header.ov || {}).length;
  for (const rs of resume.sections) { if (rs.title) n++; for (const ri of rs.items) n += Object.keys(ri.ov || {}).length; n += Object.keys(rs.fieldHide || {}).length; }
  return n;
}
export function listOverrides(master, resume) {
  const res = resolve(master, resume); const out = [];
  Object.keys(resume.header.ov || {}).forEach((k) => out.push({ where: 'Personal details', what: (HEADER_FIELDS.find((x) => x[0] === k) || [k, k])[1], kind: 'header', key: k }));
  res.sections.forEach((s) => {
    if (s.titleOv) out.push({ where: s.ms.title, what: 'Section title → "' + s.title + '"', kind: 'title', sid: s.id });
    Object.keys(s.hiddenFields).forEach((k) => out.push({ where: s.title, what: 'Field hidden: ' + ((s.fields.find((f) => f.key === k) || {}).label || k), kind: 'fieldhide', sid: s.id, key: k }));
    s.items.forEach((it) => it.ov.forEach((k) => out.push({ where: s.title + ' › ' + itemLabel(s, it.v), what: (s.fields.find((f) => f.key === k) || { label: k }).label, kind: 'field', sid: s.id, iid: it.id, key: k })));
  });
  return out;
}
export function itemLabel(sec, v) {
  const tf = sec.fields.find((f) => f.role === 'title') || sec.fields.find((f) => f.type === 'text') || sec.fields[0];
  let t = tf ? v[tf.key] : ''; if (!t && sec.kind === 'summary') t = v.label || str(v.text).slice(0, 40);
  return str(t) || 'Untitled';
}
export function itemSubLabel(sec, v) {
  const f = sec.fields.find((x) => x.role === 'subtitle'); const d = sec.fields.find((x) => x.role === 'dates');
  const bits = []; if (f && v[f.key]) bits.push(v[f.key]); if (d) { const x = fmtDateField(d, v[d.key], 'MMM YYYY', 'en'); if (x) bits.push(x); }
  return bits.join(' · ');
}

