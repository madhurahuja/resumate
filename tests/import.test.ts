import { describe, expect, it } from 'vitest';
import { csvRecords, linkedinToParsed, parseCsv } from '../src/import/linkedin';
import { liPdfNormalize, parseResumeText } from '../src/import/text';
import { irToText, buildIR } from '../src/core/ir';
import { newResume } from '../src/core/model';
import { sampleMaster } from '../src/core/sample';

describe('CSV parsing', () => {
  it('handles quotes, embedded commas, newlines and a BOM', () => {
    const rows = parseCsv('﻿a,b\n"x, y","line1\nline2"\n"say ""hi""",z\n');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'line1\nline2'], ['say "hi"', 'z']]);
  });
  it('finds the header row after a preamble', () => {
    const recs = csvRecords('Notes:\nsomething\nCompany Name,Title\nAcme,Dev\n', ['Company Name']);
    expect(recs).toEqual([{ 'Company Name': 'Acme', Title: 'Dev' }]);
  });
});

describe('LinkedIn export mapping', () => {
  const R: any = {
    profile: [{ 'First Name': 'Sample', 'Last Name': 'Person', Headline: 'Architect', Summary: 'Hello\nworld', 'Geo Location': 'Berlin', Websites: '[PERSONAL:https://example.com]' }],
    positions: [
      { 'Company Name': 'Harbor', Title: 'Principal', Description: 'Own it.\n- Cut time\n• Led migration', Location: 'Remote', 'Started On': 'Apr 2021', 'Finished On': '' },
      { 'Company Name': 'Lumen', Title: 'Senior', Description: '', Location: '', 'Started On': 'Feb 2015', 'Finished On': 'Mar 2021' },
    ],
    skills: [{ Name: 'DDD' }, { Name: 'Kafka' }],
    languages: [{ Name: 'Hindi', Proficiency: 'NATIVE_OR_BILINGUAL' }],
    emails: [{ 'Email Address': 'a@b.co', Primary: 'Yes' }],
  };
  const p = linkedinToParsed(R);
  const exp: any = p.sections.find((s) => s.kind === 'experience');
  it('maps the header', () => { expect(p.header).toMatchObject({ fullName: 'Sample Person', headline: 'Architect', email: 'a@b.co', location: 'Berlin' }); expect(p.header.links[0].url).toBe('https://example.com'); });
  it('treats an empty end date on a position as current', () => { expect(exp.items[0].dates).toEqual({ s: '2021-04', e: '', cur: true }); expect(exp.items[1].dates).toEqual({ s: '2015-02', e: '2021-03', cur: false }); });
  it('splits description into overview and bullets', () => { expect(exp.items[0].text).toBe('Own it.'); expect(exp.items[0].bullets).toEqual(['Cut time', 'Led migration']); });
  it('groups skills and prettifies language levels', () => {
    expect((p.sections.find((s) => s.kind === 'skills') as any).items[0].tags).toEqual(['DDD', 'Kafka']);
    expect((p.sections.find((s) => s.kind === 'languages') as any).items[0].level).toBe('Native or bilingual');
  });
});

describe('resume text parsing', () => {
  it('round-trips a Resumate text export', () => {
    const m = sampleMaster(); const r = newResume(m, { country: 'United States', language: 'en' }, 'classic');
    const parsed = parseResumeText(irToText(buildIR(m, r), true));
    expect(parsed.header.fullName).toBe('Sample Person');
    const kinds = parsed.sections.map((s) => s.kind);
    for (const k of ['summary', 'experience', 'education', 'skills']) expect(kinds).toContain(k);
    const exp: any = parsed.sections.find((s) => s.kind === 'experience');
    expect(exp.items[0].title).toBe('Principal Software Architect'); expect(exp.items[0].dates.cur).toBe(true);
  });

  it('reorders a LinkedIn "Save to PDF" layout (sidebar first, company before title)', () => {
    const t = `Contact\nsample@example.com\nTop Skills\nKafka\nSample Person\nPrincipal Software Architect\nBerlin, Germany\nExperience\nHarbor Payments\nPrincipal Architect\nApril 2021 - Present (5 years 6 months)\nRemote\nOwn target architecture.\nPage 1 of 2\nLumen Systems\nSenior Engineer\nFebruary 2015 - March 2021\nBerlin, Germany\nEducation\nExample Institute\nB.Tech, Computer Science · (2003 - 2007)`;
    expect(liPdfNormalize(t).split('\n')[0]).toBe('Sample Person');
    const p = parseResumeText(t); const exp: any = p.sections.find((s) => s.kind === 'experience');
    expect(p.header.fullName).toBe('Sample Person');
    expect(exp.items.map((i: any) => [i.title, i.org])).toEqual([['Principal Architect', 'Harbor Payments'], ['Senior Engineer', 'Lumen Systems']]);
    expect(exp.items[0].bullets).toEqual(['Own target architecture.']);
    const edu: any = p.sections.find((s) => s.kind === 'education');
    expect(edu.items[0]).toMatchObject({ title: 'Example Institute', degree: 'B.Tech, Computer Science' });
  });
});
