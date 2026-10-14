import { describe, expect, it } from 'vitest';
import { countOverrides, duplicateResume, newResume, resolve } from '../src/core/model';
import { sampleMaster } from '../src/core/sample';
import { buildIR, irPlain } from '../src/core/ir';
import { atsNotes, bulletQualityInsights, hasVisiblePhone, resumeHealth, textDiff } from '../src/core/analysis';
import { clone } from '../src/core/util';

const meta = { jobTitle: 'Architect', company: 'Acme', country: 'United States', language: 'en' };

describe('master + override model', () => {
  it('a resume starts as a pure reference to the master (no overrides)', () => {
    const m = sampleMaster(); const r = newResume(m, meta, 'classic');
    expect(countOverrides(m, r)).toBe(0);
    expect(irPlain(buildIR(m, r))).toContain('Sample Person');
  });

  it('an override changes only that resume, never the master or a sibling', () => {
    const m = sampleMaster(); const a = newResume(m, { ...meta, name: 'A' }, 'classic'); const b = newResume(m, { ...meta, name: 'B' }, 'classic');
    const masterBefore = clone(m); const bBefore = clone(b);
    const exp = a.sections.find((s) => m.sections.find((x) => x.id === s.ref)!.kind === 'experience')!;
    exp.items[0].ov = { title: 'Chief Architect' };
    expect(irPlain(buildIR(m, a))).toContain('Chief Architect');
    expect(irPlain(buildIR(m, b))).not.toContain('Chief Architect');
    expect(m).toEqual(masterBefore); expect(b).toEqual(bBefore);
    expect(countOverrides(m, a)).toBe(1);
  });

  it('master edits flow into resumes but keep their overrides', () => {
    const m = sampleMaster(); const r = newResume(m, meta, 'classic');
    const msec = m.sections.find((s) => s.kind === 'experience')!;
    const rsec = r.sections.find((s) => s.ref === msec.id)!;
    rsec.items[0].ov = { title: 'Chief Architect' };
    msec.items[0].v.org = 'Harbor Payments Inc';
    const text = irPlain(buildIR(m, r));
    expect(text).toContain('Harbor Payments Inc'); expect(text).toContain('Chief Architect');
  });

  it('a duplicate is independent of the original', () => {
    const m = sampleMaster(); const r = newResume(m, meta, 'classic'); const d = duplicateResume(r, 'Copy');
    expect(d.id).not.toBe(r.id); d.meta.company = 'Other';
    expect(r.meta.company).toBe('Acme');
    expect(new Set([...r.sections, ...d.sections].map((s) => s.id)).size).toBe(r.sections.length * 2);
  });

  it('resolve skips items whose master entry was deleted', () => {
    const m = sampleMaster(); const r = newResume(m, meta, 'classic');
    const msec = m.sections.find((s) => s.kind === 'experience')!; const n = msec.items.length; msec.items.pop();
    const rs = resolve(m, r).sections.find((s) => s.kind === 'experience')!;
    expect(rs.items.length).toBe(n - 1);
  });
});

describe('text diff', () => {
  it('reports added and removed lines', () => {
    const d = textDiff('a\nb\nc', 'a\nc\nd');
    expect(d.added).toBe(1); expect(d.removed).toBe(1);
  });
});

describe('resume health', () => {
  it('scores a complete resume as healthy and suggests few tweaks', () => {
    const m = sampleMaster(); const r = newResume(m, { ...meta, name: 'A', jobDescription: 'Lead product teams with strategy, execution, and mentoring across engineering' }, 'classic');
    const ir = buildIR(m, r);
    const health = resumeHealth(ir, r);
    expect(health.score).toBeGreaterThan(70);
    expect(health.suggestions.length).toBeGreaterThan(0);
    expect(health.suggestions[0]).toBeTruthy();
  });

  it('flags a thin resume with missing essentials', () => {
    const ir = { header: { name: '', headline: '', contacts: [], links: [] }, sections: [], lang: 'en' };
    const r = { meta: { jobDescription: '', industry: '' } } as any;
    const health = resumeHealth(ir, r);
    expect(health.score).toBeLessThan(60);
    expect(health.suggestions.some((item) => item.toLowerCase().includes('summary'))).toBe(true);
  });
});

describe('phone detection', () => {
  it('accepts common dashed and labeled phone formats', () => {
    expect(hasVisiblePhone('905-226-5393')).toBe(true);
    expect(hasVisiblePhone('Phone: +1 (905) 226-5393')).toBe(true);
  });

  it('does not mistake location text for a phone number', () => {
    expect(hasVisiblePhone('Toronto, ON M5V 2T6')).toBe(false);
  });

  it('does not emit ATS phone warning when a dashed phone is present', () => {
    const ir = { header: { name: 'A Person', headline: 'Engineer', contacts: ['a@b.com', '905-226-5393'], links: [] }, sections: [], lang: 'en' };
    const r = { layout: { fontSize: 10 } } as any;
    const notes = atsNotes(ir as any, r);
    expect(notes.some((n) => n.msg === 'No phone number is visible.')).toBe(false);
  });
});

describe('bullet quality insights', () => {
  it('reports quantified bullet coverage and repeated lead verbs', () => {
    const ir = {
      sections: [
        {
          entries: [
            { bullets: ['Led migration for 42 services', 'Led rollout across 3 teams', 'Led support runbook updates', 'Improved uptime by 15%'] },
          ],
        },
      ],
    } as any;
    const out = bulletQualityInsights(ir);
    expect(out.totalBullets).toBe(4);
    expect(out.quantifiedBullets).toBe(3);
    expect(out.metricCoverage).toBe(75);
    expect(out.repeatedLeadWords.some((x) => x.word === 'led' && x.count === 3)).toBe(true);
  });
});
