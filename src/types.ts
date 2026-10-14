/* Data model shared by the app, storage and exporters. */

export type FieldType = 'text' | 'textarea' | 'date' | 'daterange' | 'url' | 'bullets' | 'tags';
export type FieldRole = 'title' | 'subtitle' | 'location' | 'dates' | 'text' | 'bullets' | 'tags' | 'link' | 'extra' | 'meta';
export type DisplayMode = 'entries' | 'compact' | 'groups' | 'inline' | 'text';

export interface Field { key: string; label: string; type: FieldType; role: FieldRole; req: boolean; builtin?: boolean }
export interface DateRange { s: string; e: string; cur: boolean }
export type Values = Record<string, any>;

/* ----- master profile: the single source of truth ----- */
export interface MasterItem { id: string; v: Values }
export interface MasterSection { id: string; kind: string; title: string; display: DisplayMode; fields: Field[]; items: MasterItem[]; defaultVisible?: boolean }
export interface HeaderLink { id: string; label: string; url: string }
export interface HeaderExtra { id: string; label: string; value: string }
export interface Master {
  v: number;
  header: { values: Record<string, string>; links: HeaderLink[]; extra: HeaderExtra[] };
  sections: MasterSection[];
  updated: string; rev: number; by: string;
}

/* ----- resume: references into the master plus overrides ----- */
export interface ResumeItem { id: string; ref?: string; visible: boolean; ov?: Values; local?: boolean; v?: Values }
export interface ResumeSection {
  id: string; ref: string | null; title: string | null; visible: boolean; fieldHide: Record<string, boolean>; items: ResumeItem[];
  /* resume-only sections carry their own definition */
  local?: boolean; kind?: string; display?: DisplayMode; fields?: Field[];
  /* which column this section prints in, when the layout has more than one */
  col?: 'main' | 'side';
}
export interface ResumeMeta { jobTitle: string; company: string; country: string; language: string; industry: string; tags: string[]; notes: string; jobUrl: string; jobDescription: string }
export interface Layout {
  pageSize: string; dateFormat: string; font: string; fontSize: number; lineHeight: number; margin: number; sectionGap: number; accent: string;
  columns?: number; sidebarSide?: 'left' | 'right'; sidebarWidth?: number;
  [k: string]: any;
}
export interface Resume {
  v: number; id: string; name: string; status: string; meta: ResumeMeta; template: string; layout: Layout;
  header: { ov: Record<string, string>; hide: Record<string, boolean>; hiddenLinks: string[]; hiddenExtra: string[] };
  sections: ResumeSection[];
  created: string; updated: string; rev: number; by: string; vcount: number; lastSnapAt?: string;
}
export interface Snapshot { id: string; resumeId: string; label: string; kind: string; created: string; data: Resume; [k: string]: any }

/* ----- parsed import result (resume text, LinkedIn export, Resumate JSON) ----- */
export interface ParsedHeader { fullName: string; headline: string; email: string; phone: string; location: string; links: HeaderLink[] }
export interface ParsedSection { kind: string; title: string; items: Values[] }
export interface Parsed { header: ParsedHeader; sections: ParsedSection[] }
