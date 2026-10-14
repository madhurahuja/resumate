interface Window { claude?: any }

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_SCHEMA?: string;
  readonly VITE_SUPABASE_TABLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
