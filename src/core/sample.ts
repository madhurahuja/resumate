import { blankItem, emptyMaster } from './model';
import { uid } from './util';

/* ---------- sample content (clearly fictional) ---------- */
export function nehaMaster() {
  const m = emptyMaster();
  m.header.values = { fullName: 'Neha Aggarwal', headline: 'Business Analyst – Banking & Financial Services', email: 'Agg.neha@gmail.com', phone: '905-226-5393', location: 'Kitchener, ON' };
  m.header.links = [{ id: uid('l_'), label: 'LinkedIn', url: 'https://www.linkedin.com/in/aggneha' }];
  m.header.extra = [];
  const S = (k) => m.sections.find((s) => s.kind === k);
  const add = (k, v) => { const sec = S(k); const it = blankItem(sec); Object.assign(it.v, v); sec.items.push(it); };
  add('summary', { label: 'Business Analysis & Banking Domain', text: 'Business Analyst with 8+ years of experience in banking and financial services, with a track record of owning product backlogs, defining sprint-ready user stories and acceptance criteria, and aligning cross-functional teams around delivery outcomes. Skilled at translating business strategy into prioritized, executable work — bridging business intent and technical delivery across Agile and waterfall environments. Strong foundation in end-to-end requirements management, AS-IS / TO-BE process design, stakeholder facilitation, and UAT leadership.' });
  add('experience', { title: 'Contact Center Representative', org: 'Meridian Credit Union', location: '', dates: { s: '2025-11', e: '', cur: true }, text: 'Deliver exceptional service across phone, written, and electronic channels, resolving inquiries with empathy and accuracy.', bullets: ['Address Member requests, inquiries, and escalations with Member-focused approach aligned with organizational service standards.', 'Navigate core company systems—including CRM, Encore, Five9, and UltiPro—alongside standard software to streamline Member support.', 'Troubleshoot and resolve online banking, e-Transfer, ABM/POS operations, Visa support, and card maintenance requests within established timelines.', 'Embody corporate values and foster trust in every interaction with Members across all lines of business.'] });
  add('experience', { title: 'Product Owner / Business Analyst', org: 'Infosys Limited', location: '', dates: { s: '2010-04', e: '2014-04', cur: false }, text: 'Owned product backlog for banking initiatives spanning customer onboarding, lending, and servicing workflows.', bullets: ['Defined user stories, acceptance criteria, and sprint-ready work items aligned to business priorities.', 'Led backlog grooming, sprint planning sessions, and stakeholder walkthroughs to maintain delivery focus.', 'Defined AS-IS / TO-BE process flows and user journeys across business, operations, and technology teams.', 'Identified gaps between business intent and system capabilities; evaluated solution options and drove prioritization decisions.', 'Owned UAT planning and release readiness for five major product releases—including scenario design, defect triage, and go/no-go assessment.'] });
  add('experience', { title: 'Business Analyst / Functional Consultant – Banking Platforms', org: 'Nucleus Software Exports Limited', location: '', dates: { s: '2006-06', e: '2009-04', cur: false }, text: 'Contributed to end-to-end delivery of core banking platform supporting customer and lending workflows.', bullets: ['Translated business needs into implementable functional requirements and sprint-ready specifications.', 'Validated functional behavior during UAT cycles; coordinated defect resolution with delivery teams.', 'Reduced turnaround time for key workflows by clarifying process steps and minimizing defects through early requirement alignment.'] });
  add('experience', { title: 'Operations Analyst', org: 'Williamsburg Community Garden', location: '', dates: { s: '2024-05', e: '', cur: true }, text: 'Digitized operational workflows and intake/registration processes.', bullets: ['Reduced turnaround time from one week to one day through structured process redesign and improved information flow.', 'Designed process flows and lightweight documentation to improve accessibility and standardize execution for volunteers.', 'Applied core PO/BA methods to deliver measurable operational improvements in a resource-constrained environment.'] });
  add('education', { title: 'Foundation of Business Analysis', degree: '', location: 'University of Toronto', dates: { s: '', e: '', cur: false }, bullets: [] });
  add('education', { title: 'MBA (Operations)', degree: '', location: 'Indira Gandhi National Open University', dates: { s: '', e: '', cur: false }, bullets: [] });
  add('education', { title: 'B.Tech – Computer Engineering', degree: '', location: 'Punjab Technical University', dates: { s: '', e: '', cur: false }, bullets: [] });
  add('skills', { title: 'Software Development & Requirements', tags: ['Software Development Life Cycles (Waterfall, Agile and Hybrid)', 'Requirements Elicitation & Acceptance Criteria', 'Gap Analysis & Solution Evaluation', 'Product Solution Mapping'] });
  add('skills', { title: 'Stakeholder & Process Management', tags: ['Stakeholder Management & Workshop Facilitation', 'Solution Presentation & Product Demos', 'Cross Functional Team Collaboration', 'Product Backlog Management'] });
  add('skills', { title: 'Technical & Process Design', tags: ['Process Mapping (AS-IS / TO-BE)', 'Go-Live Readiness', 'UAT Planning & Release Readiness'] });
  add('certifications', { title: 'Professional Scrum Product Owner (PSPO)', issuer: 'Scrum Alliance', date: '', url: '' });
  add('certifications', { title: 'Professional Scrum Master (PSM)', issuer: 'Scrum Alliance', date: '', url: '' });
  add('certifications', { title: 'Canadian Securities Course (CSC)', issuer: 'CSI', date: '', url: '' });
  add('languages', { title: 'English', level: 'Fluent' });
  add('languages', { title: 'Hindi', level: 'Fluent' });
  add('languages', { title: 'Punjabi', level: 'Fluent' });
  return m;
}

export function sampleMaster() {
  const m = emptyMaster();
  m.header.values = { fullName: 'Sample Person', headline: 'Principal Software Architect (sample data)', email: 'sample.person@example.com', phone: '+1 555 0100', location: 'Remote, Earth' };
  m.header.links = [{ id: uid('l_'), label: 'LinkedIn', url: 'https://www.linkedin.com/in/sample-person' }, { id: uid('l_'), label: 'GitHub', url: 'https://github.com/sample-person' }];
  m.header.extra = [{ id: uid('e_'), label: 'Work authorisation', value: 'Open to relocation' }];
  const S = (k) => m.sections.find((s) => s.kind === k);
  const add = (k, v) => { const sec = S(k); const it = blankItem(sec); Object.assign(it.v, v); sec.items.push(it); };
  add('summary', { label: 'Architecture leadership', text: 'Architect with 15 years designing payment and data platforms on cloud-native stacks. Leads domain modelling workshops, sets technical direction across teams and keeps designs cheap to change.' });
  add('summary', { label: 'Hands-on engineering', text: 'Senior engineer who still ships code: event-driven services, API design and performance work, with a bias for small, reversible decisions.' });
  add('experience', { title: 'Principal Software Architect', org: 'Harbor Payments (fictional)', location: 'Remote', dates: { s: '2021-04', e: '', cur: true }, text: 'Own the target architecture for card and wallet services used by 40 million customers.', bullets: ['Introduced bounded contexts and an event backbone, cutting cross-team release coordination from weekly to on demand.', 'Led the migration of a monolithic ledger to event-sourced services with zero downtime.', 'Mentored 12 engineers into tech-lead roles through an architecture guild.'] });
  add('experience', { title: 'Senior Software Engineer', org: 'Lumen Systems (fictional)', location: 'Berlin, Germany', dates: { s: '2015-02', e: '2021-03', cur: false }, text: '', bullets: ['Built a multi-tenant workflow engine processing 3 million jobs a day.', 'Reduced p99 latency of the search API from 900 ms to 180 ms.', 'Introduced contract testing across 14 services.'] });
  add('education', { title: 'Example Institute of Technology', degree: 'B.Tech, Computer Science', location: '', dates: { s: '2003-08', e: '2007-06', cur: false }, bullets: [] });
  add('skills', { title: 'Architecture', tags: ['Domain-driven design', 'Event storming', 'Event-driven systems', 'API design', 'Cloud cost modelling'] });
  add('skills', { title: 'Engineering', tags: ['Java', 'Kotlin', 'TypeScript', 'PostgreSQL', 'Kafka', 'Kubernetes'] });
  add('projects', { title: 'Open-source event-store client', role: 'Maintainer · Kotlin', dates: { s: '2019-01', e: '2022-12', cur: false }, url: 'https://github.com/sample-person/event-store', text: 'Client library used by 200+ projects.', bullets: ['Cut serialization overhead by 40% with schema caching.'] });
  add('certifications', { title: 'AWS Certified Solutions Architect – Professional', issuer: 'Amazon Web Services', date: '2022-05', url: '' });
  add('languages', { title: 'English', level: 'Fluent' }); add('languages', { title: 'Hindi', level: 'Native' }); add('languages', { title: 'Punjabi', level: 'Native' });
  add('achievements', { title: 'Engineering Excellence Award', date: '2023', text: 'Company-wide recognition for the ledger migration.' });
  return m;
}
