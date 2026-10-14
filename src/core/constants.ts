import type { Field, FieldRole, FieldType } from '../types';



/* ---------- reference data ---------- */
export const PAGES = { letter: { label: 'US Letter', w: 8.5, h: 11, tw: [12240, 15840], pt: [612, 792] }, a4: { label: 'A4', w: 8.2677, h: 11.6929, tw: [11906, 16838], pt: [595.28, 841.89] } };
export const FONTS = {
  roboto: { label: 'Roboto', css: 'Roboto, "Helvetica Neue", Arial, sans-serif', pdf: 'Roboto', docx: 'Calibri' },
  inter: { label: 'Inter (sans-serif)', css: 'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif', pdf: 'Roboto', docx: 'Aptos' },
  georgia: { label: 'Georgia (serif)', css: 'Georgia, "Times New Roman", Times, serif', pdf: 'Roboto', docx: 'Cambria' },
  mono: { label: 'IBM Plex Mono (monospace)', css: '"IBM Plex Mono", "Cascadia Mono", "Consolas", monospace', pdf: 'Roboto', docx: 'Consolas' },
};
export const LANGS = {
  en: { name: 'English', locale: 'en-US', present: 'Present' },
  fr: { name: 'French', locale: 'fr-FR', present: 'Présent' },
  de: { name: 'German', locale: 'de-DE', present: 'heute' },
  es: { name: 'Spanish', locale: 'es-ES', present: 'Actualidad' },
  it: { name: 'Italian', locale: 'it-IT', present: 'Presente' },
  pt: { name: 'Portuguese', locale: 'pt-PT', present: 'Presente' },
  nl: { name: 'Dutch', locale: 'nl-NL', present: 'Heden' },
  hi: { name: 'Hindi', locale: 'hi-IN', present: 'वर्तमान' },
  pa: { name: 'Punjabi', locale: 'pa-IN', present: 'ਮੌਜੂਦਾ' },
};
export const HEADINGS = {
  en: { summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills', certifications: 'Certifications', projects: 'Projects', languages: 'Languages', achievements: 'Achievements', custom: 'Additional' },
  fr: { summary: 'Profil', experience: 'Expérience professionnelle', education: 'Formation', skills: 'Compétences', certifications: 'Certifications', projects: 'Projets', languages: 'Langues', achievements: 'Réalisations', custom: 'Divers' },
  de: { summary: 'Profil', experience: 'Berufserfahrung', education: 'Ausbildung', skills: 'Kenntnisse', certifications: 'Zertifikate', projects: 'Projekte', languages: 'Sprachen', achievements: 'Erfolge', custom: 'Weiteres' },
  es: { summary: 'Perfil', experience: 'Experiencia', education: 'Formación', skills: 'Habilidades', certifications: 'Certificaciones', projects: 'Proyectos', languages: 'Idiomas', achievements: 'Logros', custom: 'Otros' },
  it: { summary: 'Profilo', experience: 'Esperienza', education: 'Istruzione', skills: 'Competenze', certifications: 'Certificazioni', projects: 'Progetti', languages: 'Lingue', achievements: 'Risultati', custom: 'Altro' },
  pt: { summary: 'Perfil', experience: 'Experiência', education: 'Formação', skills: 'Competências', certifications: 'Certificações', projects: 'Projetos', languages: 'Idiomas', achievements: 'Conquistas', custom: 'Outros' },
  nl: { summary: 'Profiel', experience: 'Werkervaring', education: 'Opleiding', skills: 'Vaardigheden', certifications: 'Certificeringen', projects: 'Projecten', languages: 'Talen', achievements: 'Prestaties', custom: 'Overig' },
  hi: { summary: 'सारांश', experience: 'अनुभव', education: 'शिक्षा', skills: 'कौशल', certifications: 'प्रमाणपत्र', projects: 'परियोजनाएँ', languages: 'भाषाएँ', achievements: 'उपलब्धियाँ', custom: 'अन्य' },
  pa: { summary: 'ਸਾਰ', experience: 'ਤਜਰਬਾ', education: 'ਸਿੱਖਿਆ', skills: 'ਹੁਨਰ', certifications: 'ਸਰਟੀਫਿਕੇਟ', projects: 'ਪ੍ਰੋਜੈਕਟ', languages: 'ਭਾਸ਼ਾਵਾਂ', achievements: 'ਪ੍ਰਾਪਤੀਆਂ', custom: 'ਹੋਰ' },
};
export const COUNTRIES = {
  'United States': { page: 'letter', date: 'MMM YYYY', tip: 'One page up to ~10 years of experience, two for senior roles. Leave out photo, age, marital status.' },
  'Canada': { page: 'letter', date: 'MMM YYYY', tip: 'Similar to the US: 1 to 2 pages, no photo or personal details.' },
  'United Kingdom': { page: 'a4', date: 'MMM YYYY', tip: 'Usually called a CV, 2 pages. Leave out photo and date of birth.' },
  'Ireland': { page: 'a4', date: 'MMM YYYY', tip: '2 pages is common. No photo or date of birth.' },
  'Germany': { page: 'a4', date: 'MM/YYYY', tip: 'Tabular, reverse-chronological, 2 pages. A photo is optional; use German headings for German employers.' },
  'France': { page: 'a4', date: 'MM/YYYY', tip: '1 to 2 pages. Short profile section at the top is expected.' },
  'Netherlands': { page: 'a4', date: 'MMM YYYY', tip: '2 pages. Photo is optional.' },
  'Spain': { page: 'a4', date: 'MM/YYYY', tip: '2 pages. Include languages and a short profile.' },
  'India': { page: 'a4', date: 'MMM YYYY', tip: '2 to 3 pages for senior roles. Emphasise scale, team size and outcomes.' },
  'United Arab Emirates': { page: 'a4', date: 'MMM YYYY', tip: 'Nationality and visa status are often listed. Keep to 2 pages.' },
  'Singapore': { page: 'a4', date: 'MMM YYYY', tip: '2 pages. Nationality or work-pass status is commonly stated.' },
  'Australia': { page: 'a4', date: 'MMM YYYY', tip: '2 to 3 pages. Include referees only on request.' },
  'Other': { page: 'a4', date: 'MMM YYYY', tip: '' },
};
export const INDUSTRIES = ['Software', 'Fintech', 'Banking & Finance', 'Healthcare', 'E-commerce', 'Telecom', 'Consulting', 'Public sector', 'Education', 'Manufacturing', 'Media', 'Other'];
export const STATUSES = { draft: 'Draft', ready: 'Ready', sent: 'Submitted', archived: 'Archived' };
export const SWATCHES = ['#2243c9', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#1f2937'];

export const FIELD_TYPES = { text: 'Short text', textarea: 'Paragraph', date: 'Date', daterange: 'Date range', url: 'Link', bullets: 'Bullet list', tags: 'Tag list' };
export const TEXT_ROLES = { title: 'Headline', subtitle: 'Subheadline', location: 'Location', extra: 'Labelled line' };
export const DEFAULT_ROLE = { text: 'extra', textarea: 'text', date: 'extra', daterange: 'dates', url: 'link', bullets: 'bullets', tags: 'tags' };

export const F = (key: string, label: string, type: FieldType, role: FieldRole, req?: boolean): Field => ({ key, label, type, role, req: !!req, builtin: true });
export const KINDS = {
  summary: { title: 'Summary', display: 'text', fields: [F('label', 'Version name', 'text', 'meta'), F('text', 'Summary', 'textarea', 'text', true)] },
  experience: { title: 'Experience', display: 'entries', fields: [F('title', 'Job title', 'text', 'title', true), F('org', 'Company', 'text', 'subtitle'), F('location', 'Location', 'text', 'location'), F('dates', 'Dates', 'daterange', 'dates'), F('text', 'Overview', 'textarea', 'text'), F('bullets', 'Achievements', 'bullets', 'bullets')] },
  education: { title: 'Education', display: 'entries', fields: [F('title', 'Institution', 'text', 'title', true), F('degree', 'Degree / field', 'text', 'subtitle'), F('location', 'Location', 'text', 'location'), F('dates', 'Dates', 'daterange', 'dates'), F('bullets', 'Details', 'bullets', 'bullets')] },
  skills: { title: 'Skills', display: 'groups', fields: [F('title', 'Group', 'text', 'title', true), F('tags', 'Skills', 'tags', 'tags')] },
  certifications: { title: 'Certifications', display: 'compact', fields: [F('title', 'Certification', 'text', 'title', true), F('issuer', 'Issuer', 'text', 'subtitle'), F('date', 'Date', 'date', 'dates'), F('url', 'Credential link', 'url', 'link')] },
  projects: { title: 'Projects', display: 'entries', fields: [F('title', 'Project', 'text', 'title', true), F('role', 'Role / stack', 'text', 'subtitle'), F('dates', 'Dates', 'daterange', 'dates'), F('url', 'Link', 'url', 'link'), F('text', 'Description', 'textarea', 'text'), F('bullets', 'Highlights', 'bullets', 'bullets')] },
  languages: { title: 'Languages', display: 'inline', fields: [F('title', 'Language', 'text', 'title', true), F('level', 'Proficiency', 'text', 'subtitle')] },
  achievements: { title: 'Achievements', display: 'entries', fields: [F('title', 'Achievement', 'text', 'title', true), F('date', 'Date', 'date', 'dates'), F('text', 'Details', 'textarea', 'text')] },
  custom: { title: 'Custom section', display: 'entries', fields: [F('title', 'Title', 'text', 'title', true), F('sub', 'Subtitle', 'text', 'subtitle'), F('dates', 'Dates', 'daterange', 'dates'), F('text', 'Description', 'textarea', 'text'), F('bullets', 'Points', 'bullets', 'bullets')] },
};
export const DISPLAYS = { entries: 'Entries with details', compact: 'Compact lines', groups: 'Label: list', inline: 'Single running line', text: 'Paragraph' };
export const HEADER_FIELDS = [['fullName', 'Full name', 'name'], ['headline', 'Professional headline', ''], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['location', 'Location', '']];
export const DEFAULT_KINDS = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'languages', 'achievements'];

export const TEMPLATES = {
  classic: { name: 'Classic', blurb: 'Serif, centred header, ruled headings. Safe for any employer.', preset: { font: 'roboto', fontSize: 11, lineHeight: 1.25, margin: 0.8, sectionGap: 11, accent: '#1f2937', columns: 1 }, headerAlign: 'center', head: { upper: true, rule: 'ink', color: 'ink', track: 0.06 }, nameColor: 'ink', nameSize: 2.0 },
  modern: { name: 'Modern', blurb: 'Sans, left header, accent headings. Easy to scan.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.3, margin: 0.75, sectionGap: 12, accent: '#2243c9', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'accent', color: 'accent', track: 0.1 }, nameColor: 'accent', nameSize: 2.1 },
  compact: { name: 'Compact', blurb: 'Dense, 9.5 pt. Fits long careers on two pages.', preset: { font: 'roboto', fontSize: 9.5, lineHeight: 1.22, margin: 0.55, sectionGap: 8, accent: '#1f2937', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'grey', color: 'ink', track: 0.05 }, nameColor: 'ink', nameSize: 1.9 },
  minimal: { name: 'Minimal', blurb: 'Airy headings, no rules. Works well in Roboto.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.35, margin: 0.9, sectionGap: 14, accent: '#0f766e', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'none', color: 'accent', track: 0.18 }, nameColor: 'ink', nameSize: 2.0 },
  executive: { name: 'Executive', blurb: 'Large centred name, bold ink rules. Senior and leadership roles.', preset: { font: 'roboto', fontSize: 11, lineHeight: 1.3, margin: 0.85, sectionGap: 13, accent: '#1f2937', columns: 1 }, headerAlign: 'center', head: { upper: true, rule: 'ink', color: 'ink', track: 0.08 }, nameColor: 'ink', nameSize: 2.4 },
  bold: { name: 'Bold', blurb: 'Strong accent colour throughout. Stands out while staying plain-text.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.28, margin: 0.7, sectionGap: 12, accent: '#be123c', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'accent', color: 'accent', track: 0.12 }, nameColor: 'accent', nameSize: 2.3 },
  elegant: { name: 'Elegant', blurb: 'Sentence-case headings, no rules, generous spacing. Quietly refined.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.4, margin: 0.95, sectionGap: 16, accent: '#7c3aed', columns: 1 }, headerAlign: 'center', head: { upper: false, rule: 'none', color: 'accent', track: 0.02 }, nameColor: 'ink', nameSize: 2.1 },
  technical: { name: 'Technical', blurb: 'Tight, left-aligned, accent headings. Built for engineering resumes.', preset: { font: 'roboto', fontSize: 10, lineHeight: 1.25, margin: 0.6, sectionGap: 9, accent: '#0f766e', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'accent', color: 'accent', track: 0.04 }, nameColor: 'ink', nameSize: 1.8 },
  academic: { name: 'Academic', blurb: 'Centred, airy, grey rules. Suits research and education CVs.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.42, margin: 0.9, sectionGap: 16, accent: '#334155', columns: 1 }, headerAlign: 'center', head: { upper: true, rule: 'grey', color: 'ink', track: 0.04 }, nameColor: 'ink', nameSize: 1.9 },
  twotone: { name: 'Two-tone', blurb: 'Accent name, ink headings with a thin accent rule. Balanced contrast.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.3, margin: 0.75, sectionGap: 12, accent: '#b45309', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'accent', color: 'ink', track: 0.08 }, nameColor: 'accent', nameSize: 2.0 },
  sidebar: { name: 'Sidebar', blurb: 'Navy headings, muted dividers, two-column: contact, skills and certifications in a sidebar.', preset: { font: 'roboto', fontSize: 10, lineHeight: 1.15, margin: 0.65, sectionGap: 10, accent: '#1e3a5f', columns: 2, sidebarSide: 'left', sidebarWidth: 2.3 }, headerAlign: 'left', head: { upper: true, rule: 'grey', color: 'accent', track: 0.05 }, nameColor: 'accent', nameSize: 2.1 },
  nordic: { name: 'Nordic', blurb: 'Cool blue accent, clean spacing, restrained hierarchy.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.32, margin: 0.78, sectionGap: 13, accent: '#0f4c81', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'accent', color: 'ink', track: 0.09 }, nameColor: 'accent', nameSize: 2.2 },
  slate: { name: 'Slate', blurb: 'Quiet grey design with strong readability for conservative roles.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.3, margin: 0.82, sectionGap: 12, accent: '#334155', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'grey', color: 'ink', track: 0.06 }, nameColor: 'ink', nameSize: 2.0 },
  heritage: { name: 'Heritage', blurb: 'Classic serif-like proportions, centred header, elegant cadence.', preset: { font: 'georgia', fontSize: 10.5, lineHeight: 1.34, margin: 0.9, sectionGap: 14, accent: '#5b4636', columns: 1 }, headerAlign: 'center', head: { upper: false, rule: 'ink', color: 'ink', track: 0.03 }, nameColor: 'ink', nameSize: 2.25 },
  contrast: { name: 'Contrast', blurb: 'High-contrast sections and assertive headings for fast scanning.', preset: { font: 'roboto', fontSize: 10, lineHeight: 1.25, margin: 0.68, sectionGap: 10, accent: '#111827', columns: 1 }, headerAlign: 'left', head: { upper: true, rule: 'ink', color: 'accent', track: 0.11 }, nameColor: 'accent', nameSize: 2.25 },
  studio: { name: 'Studio', blurb: 'Portfolio-friendly styling with richer accent presence.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.33, margin: 0.75, sectionGap: 13, accent: '#7c3aed', columns: 1 }, headerAlign: 'left', head: { upper: false, rule: 'accent', color: 'accent', track: 0.06 }, nameColor: 'accent', nameSize: 2.3 },
  zen: { name: 'Zen', blurb: 'Minimal and airy with softer section rhythm.', preset: { font: 'roboto', fontSize: 10.5, lineHeight: 1.45, margin: 0.96, sectionGap: 18, accent: '#0f766e', columns: 1 }, headerAlign: 'left', head: { upper: false, rule: 'none', color: 'ink', track: 0.02 }, nameColor: 'ink', nameSize: 2.0 },
  splitbar: { name: 'Split Bar', blurb: 'Two-column layout with right sidebar for skills and credentials.', preset: { font: 'roboto', fontSize: 10, lineHeight: 1.18, margin: 0.66, sectionGap: 10, accent: '#7a2e8e', columns: 2, sidebarSide: 'right', sidebarWidth: 2.2 }, headerAlign: 'left', head: { upper: true, rule: 'accent', color: 'accent', track: 0.06 }, nameColor: 'accent', nameSize: 2.1 },
  aura: { name: 'Aura', blurb: 'Contemporary profile look with soft accent chips and icon badges.', preset: { font: 'roboto', fontSize: 10, lineHeight: 1.25, margin: 0.68, sectionGap: 11, accent: '#6bb9d6', columns: 2, sidebarSide: 'left', sidebarWidth: 2.45 }, headerAlign: 'left', head: { upper: true, rule: 'none', color: 'ink', track: 0.04 }, nameColor: 'ink', nameSize: 2.25, showSectionIcons: true, headlinePill: true, languageDots: true, skillChips: true },
  halo: { name: 'Halo', blurb: 'Polished modern layout with visual hierarchy and gentle contrast.', preset: { font: 'roboto', fontSize: 10.2, lineHeight: 1.27, margin: 0.7, sectionGap: 12, accent: '#5faecc', columns: 2, sidebarSide: 'left', sidebarWidth: 2.35 }, headerAlign: 'left', head: { upper: true, rule: 'none', color: 'ink', track: 0.05 }, nameColor: 'ink', nameSize: 2.2, showSectionIcons: true, headlinePill: true, languageDots: true, skillChips: true },
};
