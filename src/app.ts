import type { Master, Resume } from './types';
import { KINDS, STATUSES } from './core/constants';
import { buildIR, irPlain } from './core/ir';
import { blankItem, duplicateResume, emptyMaster, makeSection, masterIsEmpty, newResume } from './core/model';
import { nehaMaster, sampleMaster } from './core/sample';
import { Saver, Store } from './core/storage';
import { CLIENT_ID, clone, nowISO, uid } from './core/util';
import { saveBlob } from './export/validate';
import { parsedToSections } from './import/files';
import { Icon, Toasts } from './ui/base';
import { h, html, render, useEffect, useMemo, useRef, useState } from './ui/h';
import { ConfirmDialog, Dashboard, NewResumeDialog, RenameDialog } from './views/dashboard';
import { AppearanceDialog, CommandPaletteDialog, CompareView, DataPage, DiffDialog, ExportDialog, ImportDialog, OverridesDialog, ShortcutsDialog } from './views/dialogs';
import { Editor } from './views/editor';
import { MasterView } from './views/master';

/* =====================================================================
   App: state, actions, shell
   ===================================================================== */
export function App() {
  const [boot, setBoot] = useState<any>({ phase: 'loading', err: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [master, setMasterS] = useState<Master | null>(null); const [resumes, setResumesS] = useState<Record<string, Resume>>({});
  const [route, setRoute] = useState<any>({ name: 'dashboard' }); const [dlg, setDlg] = useState<any>(null); const [toasts, setToasts] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState(Saver.status); const [, setTick] = useState(0);
  const S = useRef<{ master: Master | null; resumes: Record<string, Resume>; route: any }>({ master: null, resumes: {}, route }); S.current.route = route;
  const accountMenu = useRef<HTMLDivElement | null>(null); const stacks = useRef<any>({}); const pendingDel = useRef<any>({}); const pruneT = useRef<any>({});

  useEffect(() => Saver.on(setSaveStatus), []);
  useEffect(() => {
    if (!dlg || dlg.type !== 'account') return;
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as Node | null;
      if (accountMenu.current && el && !accountMenu.current.contains(el)) setDlg(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [dlg]);
  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el.isContentEditable;
    };
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setDlg({ type: 'command' }); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key === '?') { e.preventDefault(); setDlg({ type: 'shortcuts' }); return; }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setDlg({ type: 'new' }); return; }
      if (e.key === '/') {
        if (S.current.route.name !== 'dashboard') return;
        e.preventDefault();
        const fn = (window as any).__resumateFocusSearch;
        if (typeof fn === 'function') fn();
        return;
      }
      if (e.key === '1') { e.preventDefault(); setRoute({ name: 'dashboard' }); return; }
      if (e.key === '2') { e.preventDefault(); setRoute({ name: 'master' }); return; }
      if (e.key === '3') { e.preventDefault(); setRoute({ name: 'compare' }); return; }
      if (e.key === '4') { e.preventDefault(); setRoute({ name: 'data' }); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const A = useMemo(() => {
    const stamp = (d) => { d.updated = nowISO(); d.rev = (d.rev || 0) + 1; d.by = CLIENT_ID; return d; };
    const setMaster = (m, persist = true) => { S.current.master = m; setMasterS(m); if (persist) Saver.schedule('profile', 'master', m); };
    const setResumeState = (map) => { S.current.resumes = map; setResumesS(map); };
    const toast = (msg, o: any = {}) => { const id = uid('t'); setToasts((t) => [...t.slice(-2), { id, msg, ...o }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), o.action ? 8000 : 4500); };
    const stack = (scope) => (stacks.current[scope] = stacks.current[scope] || { past: [], future: [], lk: null, lt: 0 });
    const pushUndo = (scope, prev, key?) => {
      const st = stack(scope); const t = Date.now();
      if (key && st.lk === key && t - st.lt < 1500) { st.lt = t; return; }
      st.past.push(prev); if (st.past.length > 100) st.past.shift(); st.future = []; st.lk = key || null; st.lt = t; setTick((n) => n + 1);
    };
    const ensureMasterSaved = () => { if (!S.current.master.rev) { const d = clone(S.current.master); stamp(d); setMaster(d); } };

    const writeSnapshot = (res, label, kind) => {
      const id = res.id + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
      const doc = { resumeId: res.id, at: nowISO(), kind, label, resume: clone(res), text: irPlain(buildIR(S.current.master, res)), by: CLIENT_ID };
      Saver.schedule('snapshots', id, doc, 50);
      clearTimeout(pruneT.current[res.id]);
      pruneT.current[res.id] = setTimeout(async () => {
        try { const list = (await Store.query('snapshots', 'resumeId', res.id)).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)); let extra = list.length - 30; for (const s of list) { if (extra <= 0) break; if (s.kind === 'manual') continue; await Store.del('snapshots', s._id); extra--; } } catch (e) { /* best effort */ }
      }, 3000);
    };
    const commitResume = (next, o: any = {}) => {
      if (o.touch !== false) { next.updated = nowISO(); next.rev = (next.rev || 0) + 1; next.by = CLIENT_ID; }
      const last = Date.parse(next.lastSnapAt) || 0;
      if (o.snap || (o.auto !== false && Date.now() - last > 600000)) { next.vcount = (next.vcount || 0) + 1; next.lastSnapAt = nowISO(); writeSnapshot(next, o.label || 'Autosave', o.kind || 'auto'); }
      setResumeState({ ...S.current.resumes, [next.id]: next }); Saver.schedule('resumes', next.id, next);
    };
    const go = (r) => { Saver.flushAll(); setRoute(r); const m = document.querySelector('.main'); if (m) m.scrollTop = 0; };

    const api = {
      go, toast, mode: Store.mode,
      auth: Store.auth,
      dialog: (d) => setDlg(d), closeDialog: () => setDlg(null),
      stamp, setMaster,
      updateMaster(fn, key) { const prev = S.current.master; const d = clone(prev); fn(d); stamp(d); pushUndo('master', prev, key); setMaster(d); },
      updateResume(id, fn, key?) { const prev = S.current.resumes[id]; if (!prev) return; const d = clone(prev); fn(d); pushUndo('res:' + id, prev, key); commitResume(d); },
      canUndo: (scope) => !!(stacks.current[scope] && stacks.current[scope].past.length),
      canRedo: (scope) => !!(stacks.current[scope] && stacks.current[scope].future.length),
      undo(scope) {
        const st = stack(scope); if (!st.past.length) return; const prev = st.past.pop(); st.lk = null;
        if (scope === 'master') { st.future.push(S.current.master); const d = clone(prev); stamp(d); setMaster(d); } else { const id = scope.slice(4); const cur = S.current.resumes[id]; if (!cur) return; st.future.push(cur); const d = clone(prev); commitResume(d); }
        setTick((n) => n + 1);
      },
      redo(scope) {
        const st = stack(scope); if (!st.future.length) return; const nxt = st.future.pop(); st.lk = null;
        if (scope === 'master') { st.past.push(S.current.master); const d = clone(nxt); stamp(d); setMaster(d); } else { const id = scope.slice(4); const cur = S.current.resumes[id]; if (!cur) return; st.past.push(cur); const d = clone(nxt); commitResume(d); }
        setTick((n) => n + 1);
      },
      createResume(meta, templateId, sourceId) {
        ensureMasterSaved(); let r;
        if (sourceId && S.current.resumes[sourceId]) { r = duplicateResume(S.current.resumes[sourceId], meta.name); r.meta = { ...r.meta, jobTitle: meta.jobTitle, company: meta.company, country: meta.country, language: meta.language, industry: meta.industry }; }
        else r = newResume(S.current.master, meta, templateId);
        r.vcount = 1; r.lastSnapAt = nowISO();
        setResumeState({ ...S.current.resumes, [r.id]: r }); Saver.schedule('resumes', r.id, r); writeSnapshot(r, 'Created', 'created');
        go({ name: 'editor', id: r.id });
      },
      duplicateResume(id) {
        const src = S.current.resumes[id]; if (!src) return; let name = 'Copy of ' + src.name; const names = new Set(Object.values(S.current.resumes).map((x) => x.name));
        for (let i = 2; names.has(name); i++) name = 'Copy of ' + src.name + ' (' + i + ')';
        const r = duplicateResume(src, name); r.vcount = 1; r.lastSnapAt = nowISO();
        setResumeState({ ...S.current.resumes, [r.id]: r }); Saver.schedule('resumes', r.id, r); writeSnapshot(r, 'Duplicated from "' + src.name + '"', 'created');
        toast('Duplicated as "' + name + '". The copy is independent.', { action: { label: 'Open', fn: () => go({ name: 'editor', id: r.id }) } });
      },
      renameResume(id, name) { api.updateResume(id, (d) => { d.name = name; }); },
      setStatus(id, status) { api.updateResume(id, (d) => { d.status = status; }); toast(status === 'archived' ? 'Archived. Find it again with the Status filter.' : 'Status set to ' + STATUSES[status] + '.'); },
      deleteResume(id) {
        const r = S.current.resumes[id]; if (!r) return;
        const map = { ...S.current.resumes }; delete map[id]; setResumeState(map);
        Saver.remove('resumes', id).catch(() => {});
        const kill = async () => { delete pendingDel.current[id]; try { const l = await Store.query('snapshots', 'resumeId', id); await Promise.all(l.map((s) => Store.del('snapshots', s._id))); } catch (e) { /* best effort */ } };
        const tm = setTimeout(kill, 10000); pendingDel.current[id] = { tm, kill };
        toast('Deleted "' + r.name + '".', { action: { label: 'Undo', fn: () => { const p = pendingDel.current[id]; if (p) { clearTimeout(p.tm); delete pendingDel.current[id]; } setResumeState({ ...S.current.resumes, [id]: r }); Saver.schedule('resumes', id, r, 0); } } });
      },
      deleteMasterItem(sid, iid, mode) {
        const prev = S.current.master; const d = clone(prev); const sec = d.sections.find((s) => s.id === sid); if (!sec) return; const item = sec.items.find((i) => i.id === iid);
        sec.items = sec.items.filter((i) => i.id !== iid); stamp(d); pushUndo('master', prev); setMaster(d);
        if (mode === 'keep' && item) Object.values(S.current.resumes).forEach((r) => { let hit = false; const c = clone(r); c.sections.forEach((rs) => { if (rs.ref !== sid) return; rs.items.forEach((ri) => { if (ri.ref === iid) { ri.local = true; ri.v = { ...item.v, ...(ri.ov || {}) }; delete ri.ref; delete ri.ov; hit = true; } }); }); if (hit) commitResume(c); });
        toast('Entry deleted.', { action: { label: 'Undo', fn: () => api.undo('master') } });
      },
      deleteMasterSection(sid, mode) {
        const prev = S.current.master; const d = clone(prev); const sec = d.sections.find((s) => s.id === sid); if (!sec) return;
        d.sections = d.sections.filter((s) => s.id !== sid); stamp(d); pushUndo('master', prev); setMaster(d);
        if (mode === 'keep') Object.values(S.current.resumes).forEach((r) => { if (!r.sections.some((rs) => rs.ref === sid)) return; const c = clone(r); c.sections.forEach((rs) => { if (rs.ref !== sid) return; rs.local = true; rs.kind = sec.kind; rs.display = rs.display || sec.display; rs.fields = clone(sec.fields); rs.title = rs.title || sec.title; rs.items.forEach((ri) => { const mi = sec.items.find((i) => i.id === ri.ref); ri.local = true; ri.v = { ...(mi ? mi.v : {}), ...(ri.ov || {}) }; delete ri.ref; delete ri.ov; }); delete rs.ref; }); commitResume(c); });
        toast('Section deleted.', { action: { label: 'Undo', fn: () => api.undo('master') } });
      },
      revertOverride(id, o) {
        api.updateResume(id, (d) => {
          if (o.kind === 'header') delete d.header.ov[o.key];
          else { const rs = d.sections.find((s) => s.id === o.sid); if (!rs) return; if (o.kind === 'title') rs.title = null; else if (o.kind === 'fieldhide') delete rs.fieldHide[o.key]; else if (o.kind === 'field') { const ri = rs.items.find((i) => i.id === o.iid); if (ri) delete ri.ov[o.key]; } }
        });
      },
      revertAll(id) { api.updateResume(id, (d) => { d.header.ov = {}; d.sections.forEach((rs) => { if (!rs.local) rs.title = null; rs.fieldHide = {}; rs.items.forEach((ri) => { if (!ri.local) ri.ov = {}; }); }); }); toast('All resume-specific edits reverted.', { action: { label: 'Undo', fn: () => api.undo('res:' + id) } }); },
      snapshot(id, label, kind) { const cur = S.current.resumes[id]; if (!cur) return; const d = clone(cur); d.vcount = (d.vcount || 0) + 1; d.lastSnapAt = nowISO(); commitResume(d, { auto: false, touch: false }); writeSnapshot(d, label, kind); toast('Version saved.'); },
      async listSnapshots(id) { await Saver.flushAll(); return (await Store.query('snapshots', 'resumeId', id)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)); },
      restoreSnapshot(id, snap) {
        const cur = S.current.resumes[id]; if (!cur) return;
        const before = clone(cur); writeSnapshot(before, 'Before restoring "' + snap.label + '"', 'restore');
        pushUndo('res:' + id, cur);
        const next = clone(snap.resume); next.id = id; next.vcount = (cur.vcount || 0) + 1; next.lastSnapAt = nowISO();
        commitResume(next, { auto: false }); toast('Restored "' + snap.label + '".', { action: { label: 'Undo', fn: () => api.undo('res:' + id) } });
      },
      async deleteSnapshot(id, sid) { await Store.del('snapshots', sid); const cur = S.current.resumes[id]; if (cur) { const d = clone(cur); d.vcount = Math.max(0, (d.vcount || 1) - 1); commitResume(d, { auto: false, touch: false }); } },
      async backup() {
        const data = { format: 'resumate.backup', version: 1, exportedAt: nowISO(), master: S.current.master, resumes: Object.values(S.current.resumes) };
        try { await saveBlob('resumate-backup-' + new Date().toISOString().slice(0, 10) + '.json', new Blob([JSON.stringify(data)], { type: 'application/json' })); toast('Backup saved.'); }
        catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'unavailable' ? 'Saving files is not available in this view.' : 'Could not save the backup.', { kind: 'bad' }); }
      },
      restoreBackup(b, mode) {
        try {
          if (!b.master || !b.master.sections || !Array.isArray(b.resumes)) throw new Error('bad');
          if (mode === 'replace') {
            Object.keys(S.current.resumes).forEach((id) => Saver.remove('resumes', id).catch(() => {}));
            const m = clone(b.master); stamp(m); setMaster(m); const map = {};
            b.resumes.forEach((r) => { const c = clone(r); c.by = CLIENT_ID; c.rev = (c.rev || 0) + 1; map[c.id] = c; Saver.schedule('resumes', c.id, c); }); setResumeState(map);
          } else {
            const d = clone(S.current.master);
            if (masterIsEmpty(d)) d.header = clone(b.master.header);
            b.master.sections.forEach((bs) => { const ex = d.sections.find((s) => s.id === bs.id); if (!ex) d.sections.push(clone(bs)); else bs.items.forEach((bi) => { if (!ex.items.some((i) => i.id === bi.id)) ex.items.push(clone(bi)); }); });
            stamp(d); setMaster(d); const map = { ...S.current.resumes };
            b.resumes.forEach((r) => { const c = duplicateResume(r, r.name); c.vcount = 1; c.lastSnapAt = nowISO(); map[c.id] = c; Saver.schedule('resumes', c.id, c); });
            setResumeState(map);
          }
          stacks.current = {}; toast('Backup restored.'); go({ name: 'dashboard' });
        } catch (e) { toast('That backup file could not be read.', { kind: 'bad' }); }
      },
      importParsed(parsed, mode, name) {
        const base = S.current.master; const meta = { name, country: 'Other', language: 'en' };
        if (mode === 'master') {
          const prev = base; const d = clone(base); const had = masterIsEmpty(prev); const hv = parsed.header;
          ['fullName', 'headline', 'email', 'phone', 'location'].forEach((k) => { if (hv[k] && (had || !d.header.values[k])) d.header.values[k] = hv[k]; });
          (hv.links || []).forEach((l) => { if (!d.header.links.some((x) => x.url === l.url)) d.header.links.push(l); });
          const imported = new Set();
          parsed.sections.forEach((ps) => {
            let sec = ps.kind !== 'custom' ? d.sections.find((s) => s.kind === ps.kind) : null;
            if (!sec) { sec = makeSection(KINDS[ps.kind] ? ps.kind : 'custom', ps.title); d.sections.push(sec); }
            ps.items.forEach((v) => { const it = blankItem(sec); sec.fields.forEach((f) => { if (v[f.key] !== undefined) it.v[f.key] = v[f.key]; }); sec.items.push(it); imported.add(it.id); });
          });
          stamp(d); pushUndo('master', prev); setMaster(d);
          const r = newResume(d, meta, 'classic');
          r.sections.forEach((rs) => { let first = true; rs.items.forEach((ri) => { const ok = imported.has(ri.ref); const ms = d.sections.find((s) => s.id === rs.ref); ri.visible = ok && (ms.kind !== 'summary' || first); if (ok) first = false; }); });
          r.vcount = 1; r.lastSnapAt = nowISO(); setResumeState({ ...S.current.resumes, [r.id]: r }); Saver.schedule('resumes', r.id, r); writeSnapshot(r, 'Imported', 'created');
          toast('Imported into your master profile.'); go({ name: 'editor', id: r.id });
        } else {
          ensureMasterSaved(); const r = newResume(S.current.master, meta, 'classic');
          r.sections = parsedToSections(parsed).map((sec) => ({ id: uid('r_'), ref: null, local: true, kind: sec.kind, title: sec.title, display: sec.display, fields: sec.fields, visible: true, fieldHide: {}, items: sec.items.map((it) => ({ id: uid('x_'), local: true, visible: true, v: it.v })) }));
          const ov = {}; ['fullName', 'headline', 'email', 'phone', 'location'].forEach((k) => { if (parsed.header[k]) ov[k] = parsed.header[k]; }); r.header.ov = ov;
          r.vcount = 1; r.lastSnapAt = nowISO(); setResumeState({ ...S.current.resumes, [r.id]: r }); Saver.schedule('resumes', r.id, r); writeSnapshot(r, 'Imported', 'created');
          toast('Imported as a stand-alone resume.'); go({ name: 'editor', id: r.id });
        }
      },
      loadSample() {
        const m = sampleMaster(); stamp(m); setMaster(m);
        const mk = (meta, tpl, edit) => { const r = newResume(m, meta, tpl); edit(r); r.vcount = 1; r.lastSnapAt = nowISO(); r.updated = nowISO(); r.rev = 1; return r; };
        const sumA = m.sections[0].items[0].id; const sumB = m.sections[0].items[1].id;
        const r1 = mk({ name: 'Principal Architect – Harbor (sample)', jobTitle: 'Principal Architect', company: 'Harbor Payments', country: 'United States', language: 'en', industry: 'Fintech', tags: ['sample', 'leadership'] }, 'classic', () => {});
        const r2 = mk({ name: 'Staff Engineer – Lumen DE (sample)', jobTitle: 'Staff Engineer', company: 'Lumen Systems', country: 'Germany', language: 'en', industry: 'Software', tags: ['sample', 'hands-on'] }, 'modern', (r) => {
          const sm = r.sections[0]; sm.items.forEach((ri) => { ri.visible = ri.ref === sumB; });
          const ex = r.sections.find((rs) => rs.ref === m.sections[1].id); ex.items[0].ov = { title: 'Staff Software Engineer (architecture)' };
          r.sections.find((rs) => rs.ref === m.sections[7].id).visible = false; r.meta.notes = 'Sample: hands-on summary, retitled role, achievements hidden.';
        });
        void sumA; r2.updated = new Date(Date.now() - 3600e3).toISOString();
        setResumeState({ ...S.current.resumes, [r1.id]: r1, [r2.id]: r2 }); Saver.schedule('resumes', r1.id, r1); Saver.schedule('resumes', r2.id, r2);
        writeSnapshot(r1, 'Created', 'created'); writeSnapshot(r2, 'Created', 'created');
        toast('Loaded fictional sample data. Remove it any time from Data and backup.'); go({ name: 'dashboard' });
      },
      loadNehaSample() {
        const m = nehaMaster(); stamp(m); setMaster(m);
        const r = newResume(m, { name: 'Business Analyst – Banking (sample)', jobTitle: 'Business Analyst', company: 'Meridian Credit Union', country: 'Canada', language: 'en', industry: 'Banking & Finance', tags: ['sample', 'ba'] }, 'modern');
        r.vcount = 1; r.lastSnapAt = nowISO(); r.updated = nowISO(); r.rev = 1;
        setResumeState({ ...S.current.resumes, [r.id]: r }); Saver.schedule('resumes', r.id, r);
        writeSnapshot(r, 'Created', 'created');
        toast('Loaded Neha Aggarwal\'s Business Analyst sample. Remove it any time from Data and backup.'); go({ name: 'dashboard' });
      },
      async eraseAll() {
        try {
          const rs = await Store.list('resumes'); const ss = await Store.list('snapshots');
          await Promise.all([...rs.map((r) => Saver.remove('resumes', r._id)), ...ss.map((s) => Store.del('snapshots', s._id)), Saver.remove('profile', 'master')]);
        } catch (e) { toast('Some data could not be erased. Try again.', { kind: 'bad' }); return; }
        Object.keys(S.current.resumes).forEach((id) => Saver.remove('resumes', id).catch(() => {}));
        stacks.current = {}; setResumeState({}); const m = emptyMaster(); S.current.master = m; setMasterS(m); toast('All data erased.'); go({ name: 'dashboard' });
      },
      async signInGoogle() { await Store.signInWithGoogle(); },
      async signOut() { await Saver.flushAll(); await Store.signOut(); },
      _boot(m, map) { S.current.master = m; setMasterS(m); setResumeState(map); },
      _remote: { resumes(type, id, data) { const cur = S.current.resumes[id]; if (type === 'removed') { if (cur && !Saver.queue.has('resumes/' + id) && !pendingDel.current[id]) { const map = { ...S.current.resumes }; delete map[id]; setResumeState(map); if (S.current.route.name === 'editor' && S.current.route.id === id) setRoute({ name: 'dashboard' }); } return; } if (!data || data.by === CLIENT_ID) return; if (!cur || Date.parse(data.updated) > Date.parse(cur.updated)) { if (Saver.queue.has('resumes/' + id)) return; setResumeState({ ...S.current.resumes, [id]: data }); if (S.current.route.name === 'editor' && S.current.route.id === id) toast('Updated from another device.'); } }, profile(type, id, data) { if (id !== 'master' || !data || data.by === CLIENT_ID || type === 'removed') return; if (Date.parse(data.updated) > Date.parse(S.current.master.updated) && !Saver.queue.has('profile/master')) { S.current.master = data; setMasterS(data); } } },
    };
    return api;
  }, []);

  /* boot */
  useEffect(() => {
    let unsubs = [];
    (async () => {
      try {
        await Store.init();
        if (Store.mode === 'auth') { setBoot({ phase: 'auth', err: '' }); return; }
        const m = (await Store.get('profile', 'master')) || emptyMaster();
        const list = await Store.list('resumes'); const map = {};
        list.forEach((d) => { const { _id, ...r } = d; map[r.id || _id] = r; });
        A._boot(m, map); setBoot({ phase: 'ready' });
        unsubs = [Store.subscribe('resumes', A._remote.resumes), Store.subscribe('profile', A._remote.profile)];
      } catch (e) { setBoot({ phase: 'error', err: (e && e.message) || 'Could not load your data.' }); }
    })();
    const kill = () => Object.values<any>(pendingDel.current).forEach((p) => { clearTimeout(p.tm); p.kill(); });
    window.addEventListener('pagehide', kill);
    return () => { unsubs.forEach((u) => u()); window.removeEventListener('pagehide', kill); };
  }, []);

  if (boot.phase === 'loading') return html`<div class="empty" style="height:100%;align-content:center" role="status"><div class="brand-mark">R</div><p>Opening your resumes…</p></div>`;
  if (boot.phase === 'auth') return html`<div class="auth-shell" role="main">
    <div class="auth-card">
      <div class="auth-logo-band"><img class="auth-logo" src="/resumate.logo.gif" alt="Resumate" /></div>
      <div class="auth-content">
        <h2>Welcome back</h2>
        <p class="muted">Use your Google account to access your resumes and keep everything synced.</p>
        ${authErr && html`<div class="callout bad" role="alert">${authErr}</div>`}
        <button type="button" class="btn primary" disabled=${authBusy} onClick=${async () => {
          setAuthErr(''); setAuthBusy(true);
          try { await Store.signInWithGoogle(); }
          catch (e) { setAuthErr((e && e.message) || 'Sign-in failed.'); setAuthBusy(false); }
        }}><${Icon} n="link" />${authBusy ? 'Opening Google sign-in…' : 'Continue with Google'}</button>
      </div>
    </div>
  </div>`;
  if (boot.phase === 'error') return html`<div class="empty" style="height:100%;align-content:center" role="alert"><h2>Could not open your data</h2><p>${boot.err}</p><button type="button" class="btn primary" onClick=${() => location.reload()}><${Icon} n="restore" />Try again</button></div>`;

  const api = { ...A, master, resumes, saveStatus, mode: Store.mode, auth: Store.auth };
  const userEmail = Store.auth.user?.email || (Store.auth.user ? 'Google account' : '');
  const userName = Store.auth.user?.name || userEmail || 'Google account';
  const userAvatar = Store.auth.user?.avatarUrl || null;
  const userInitials = (() => {
    const raw = userName || 'R';
    const parts = raw.split(/[\s@._-]+/).filter(Boolean);
    const letters = parts.length >= 2 ? [parts[0][0], parts[1][0]] : [raw[0], raw[1] || raw[0]];
    return letters.map((ch) => ch && ch.toUpperCase()).join('').slice(0, 2) || 'R';
  })();
  const nRes = Object.values(resumes).filter((r) => r.status !== 'archived').length;
  const nav = [['dashboard', 'Resumes', 'file', nRes], ['master', 'Master profile', 'user', null], ['compare', 'Compare', 'compare', null], ['data', 'Data & backup', 'database', null]];
  const cur = route.name === 'editor' ? 'dashboard' : route.name;
  const inEd = route.name === 'editor';
  let view;
  if (route.name === 'master') view = html`<${MasterView} A=${api} />`;
  else if (route.name === 'compare') view = html`<${CompareView} A=${api} />`;
  else if (route.name === 'data') view = html`<${DataPage} A=${api} />`;
  else if (route.name === 'editor') view = html`<${Editor} A=${api} id=${route.id} />`;
  else view = html`<${Dashboard} A=${api} />`;
  let dialogEl = null;
  if (dlg) {
    if (dlg.type === 'new') dialogEl = html`<${NewResumeDialog} A=${api} />`;
    else if (dlg.type === 'rename') dialogEl = html`<${RenameDialog} A=${api} id=${dlg.id} />`;
    else if (dlg.type === 'confirm') dialogEl = html`<${ConfirmDialog} A=${api} d=${dlg} />`;
    else if (dlg.type === 'export') dialogEl = html`<${ExportDialog} A=${api} id=${dlg.id} kind=${dlg.kind} key=${dlg.id + dlg.kind} />`;
    else if (dlg.type === 'diff') dialogEl = html`<${DiffDialog} A=${api} d=${dlg} />`;
    else if (dlg.type === 'overrides') dialogEl = html`<${OverridesDialog} A=${api} id=${dlg.id} />`;
    else if (dlg.type === 'appearance') dialogEl = html`<${AppearanceDialog} A=${api} />`;
    else if (dlg.type === 'import') dialogEl = html`<${ImportDialog} A=${api} />`;
    else if (dlg.type === 'shortcuts') dialogEl = html`<${ShortcutsDialog} A=${api} />`;
    else if (dlg.type === 'command') dialogEl = html`<${CommandPaletteDialog} A=${api} />`;
  }
  return html`<div class=${'shell ' + (inEd ? 'in-editor' : '')}>
    <nav class="rail" aria-label="Main">
      <div class="brand"><img class="brand-logo" src="/resumate.logo.png" alt="" aria-hidden="true" /><span class="brand-name">Resumate</span></div>
      ${nav.map(([k, l, ic, n]) => html`<button type="button" class="nav-btn" key=${k} aria-current=${cur === k ? 'page' : undefined} onClick=${() => api.go({ name: k })} title=${l}><${Icon} n=${ic} /><span class="nav-label">${l}</span>${n != null && html`<span class="nav-count">${n}</span>`}</button>`)}
      <div class="rail-foot">
        ${Store.auth.user ? html`<div class="user-menu-wrap" ref=${accountMenu}>
          <button type="button" class="userchip" aria-live="polite" title="Account menu" onClick=${() => setDlg((d) => d && d.type === 'account' ? null : { type: 'account' })}>
            <div class="userchip-avatar" aria-hidden="true">${userAvatar ? html`<img src=${userAvatar} alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" />` : userInitials}</div>
            <div class="userchip-copy">
              <div class="userchip-name">${userName || userEmail || 'Signed in'}</div>
              <div class="userchip-role">${Store.mode === 'supabase' ? 'Supabase user' : 'Authenticated'}</div>
            </div>
          </button>
          ${dlg && dlg.type === 'account' ? html`<div class="user-menu">
            <div class="user-menu-card">
              <div class="user-menu-head">
                <div class="userchip-avatar large">${userAvatar ? html`<img src=${userAvatar} alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block" />` : userInitials}</div>
                <div>
                  <div class="user-menu-name">${userName || userEmail || 'Signed in'}</div>
                  <div class="user-menu-email">${userEmail || 'Google account'}</div>
                </div>
              </div>
              <div class="user-menu-meta">
                <div><span>Provider</span><strong>${Store.mode === 'supabase' ? 'Google' : 'App session'}</strong></div>
              </div>
              <button type="button" class="btn danger" onClick=${async () => { try { await Store.signOut(); setDlg(null); location.reload(); } catch (e) { setToasts((t) => [...t, { id: uid('t'), msg: (e && e.message) || 'Could not sign out.', kind: 'bad' }]); } }}>
                Sign out
              </button>
            </div>
          </div>` : null}
        </div>` : null}
        <button type="button" class="nav-btn" onClick=${() => api.dialog({ type: 'command' })} title="Quick actions (Ctrl/Cmd+K)"><${Icon} n="search" /><span class="nav-label">Quick actions</span></button>
        <button type="button" class="nav-btn" onClick=${() => api.dialog({ type: 'appearance' })} title="Appearance"><${Icon} n="sliders" /><span class="nav-label">Appearance</span></button>
        <button type="button" class="nav-btn" onClick=${() => api.dialog({ type: 'shortcuts' })} title="Keyboard shortcuts"><${Icon} n="info" /><span class="nav-label">Keyboard shortcuts</span></button>
        <span class="nav-label">${Store.mode === 'cloud' || Store.mode === 'supabase' ? 'Private store, syncs across your devices' : 'Stored in this browser only'}</span>
      </div>
    </nav>
    <main class="main" id="main" style=${inEd ? 'overflow:hidden' : ''}>${view}</main>
    ${dialogEl}
    <${Toasts} items=${toasts} dismiss=${(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
  </div>`;
}
render(h(App as any, null), document.getElementById('app')!);
