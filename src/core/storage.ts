import { nowISO } from './util';

/* =====================================================================
   Storage: adapter interface + runtime-selected implementations.
   Cloud (Claude db capability) > Supabase (Google OAuth + RLS) > IndexedDB (file-backed, per-origin) > localStorage (last resort).
   Any future backend (e.g. Supabase) just needs to implement this same Adapter shape and get
   wired into Store.init() below — nothing else in the app talks to the backend directly.
   ===================================================================== */
export interface Adapter {
  get(coll: string, id: string): Promise<any>;
  list(coll: string): Promise<any[]>;
  put(coll: string, id: string, data: any): Promise<void>;
  del(coll: string, id: string): Promise<void>;
  subscribe?(coll: string, cb: (type: string, id: string, data: any, meta: any) => void): () => void;
}

export interface AuthState {
  provider: 'none' | 'supabase-google';
  required: boolean;
  user: null | { id: string; email?: string; name?: string; avatarUrl?: string | null };
}

/* ---------- cloud adapter: Claude artifact runtime's shared db capability ---------- */
function cloudAdapter(db): Adapter {
  return {
    async get(coll, id) { const s = await db.doc(coll + '/' + id).get(); return s.exists ? s.data() : null; },
    async list(coll) { const s = await db.collection(coll).get(); return s.docs.map((d) => ({ ...d.data(), _id: d.id })); },
    async put(coll, id, data) { await db.doc(coll + '/' + id).set(data); },
    async del(coll, id) { await db.doc(coll + '/' + id).delete(); },
    subscribe(coll, cb) {
      try { return db.collection(coll).onSnapshot((snap) => { snap.docChanges().forEach((ch) => cb(ch.type, ch.doc.id, ch.doc.data(), snap.metadata)); }, () => {}); }
      catch (e) { return () => {}; }
    },
  };
}

/* ---------- IndexedDB adapter: real per-origin file-backed database ---------- */
const IDB_NAME = 'resumate'; const IDB_VERSION = 1; const IDB_STORES = ['profile', 'resumes', 'snapshots'];
function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => { const d = req.result; IDB_STORES.forEach((s) => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked by another open tab.'));
  });
}
function wrap<T>(req: IDBRequest): Promise<T> { return new Promise((res, rej) => { req.onsuccess = () => res(req.result as T); req.onerror = () => rej(req.error); }); }
function idbAdapter(dbp: Promise<IDBDatabase>): Adapter {
  const store = async (coll, mode: IDBTransactionMode) => { const db = await dbp; return db.transaction(coll, mode).objectStore(coll); };
  return {
    async get(coll, id) { const s = await store(coll, 'readonly'); return (await wrap(s.get(id))) ?? null; },
    async list(coll) {
      const s = await store(coll, 'readonly');
      const [keys, vals] = await Promise.all([wrap<IDBValidKey[]>(s.getAllKeys()), wrap<any[]>(s.getAll())]);
      return vals.map((v, i) => ({ ...v, _id: String(keys[i]) }));
    },
    async put(coll, id, data) { const s = await store(coll, 'readwrite'); await wrap(s.put(data, id)); },
    async del(coll, id) { const s = await store(coll, 'readwrite'); await wrap(s.delete(id)); },
  };
}

/* ---------- localStorage adapter: fallback if IndexedDB is unavailable (e.g. locked-down privacy mode) ---------- */
function lsAdapter(): Adapter {
  const key = (coll, id) => 'resumate:' + coll + ':' + id;
  return {
    async get(coll, id) { try { const t = localStorage.getItem(key(coll, id)); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
    async list(coll) {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('resumate:' + coll + ':')) out.push({ ...JSON.parse(localStorage.getItem(k)), _id: k.split(':').slice(2).join(':') }); } } catch (e) { /* ignore */ }
      return out;
    },
    async put(coll, id, data) { localStorage.setItem(key(coll, id), JSON.stringify(data)); },
    async del(coll, id) { localStorage.removeItem(key(coll, id)); },
  };
}

function authRequiredAdapter(): Adapter {
  const noAuthErr = () => new Error('Sign in is required before data can be loaded.');
  return {
    async get() { throw noAuthErr(); },
    async list() { throw noAuthErr(); },
    async put() { throw noAuthErr(); },
    async del() { throw noAuthErr(); },
  };
}

function hasSupabaseConfig() {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

async function initSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const schema = import.meta.env.VITE_SUPABASE_SCHEMA || 'resumate';
  const table = import.meta.env.VITE_SUPABASE_TABLE || 'docs';
  if (!url || !anon) return null;
  const mod = await import('@supabase/supabase-js');
  const client = mod.createClient(url, anon, {
    db: { schema },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return { client, schema, table };
}

function supabaseAdapter(client, schema: string, table: string): Adapter {
  const assertOk = (error, op: string) => { if (error) throw new Error('Supabase ' + op + ' failed: ' + error.message); };
  const docs = () => client.schema(schema).from(table);
  const norm = (data) => {
    if (!data || typeof data !== 'object') return {};
    if (Array.isArray(data)) return { value: data };
    return data;
  };
  const toType = (ev) => {
    if (ev === 'INSERT') return 'added';
    if (ev === 'UPDATE') return 'modified';
    if (ev === 'DELETE') return 'removed';
    return 'modified';
  };
  return {
    async get(coll, id) {
      const q = await docs().select('data').eq('collection', coll).eq('doc_id', id).maybeSingle();
      assertOk(q.error, 'get');
      return q.data ? q.data.data : null;
    },
    async list(coll) {
      const q = await docs().select('doc_id,data').eq('collection', coll);
      assertOk(q.error, 'list');
      return (q.data || []).map((r) => ({ ...norm(r.data), _id: r.doc_id }));
    },
    async put(coll, id, data) {
      const patch = { data, updated_at: nowISO() };
      const upd = await docs().update(patch).eq('collection', coll).eq('doc_id', id).select('doc_id');
      assertOk(upd.error, 'update');
      if ((upd.data || []).length > 0) return;
      const ins = await docs().insert({ collection: coll, doc_id: id, data, updated_at: nowISO() });
      if (!ins.error) return;
      if (ins.error.code === '23505') {
        const upd2 = await docs().update(patch).eq('collection', coll).eq('doc_id', id);
        assertOk(upd2.error, 'update after conflict');
        return;
      }
      assertOk(ins.error, 'insert');
    },
    async del(coll, id) {
      const q = await docs().delete().eq('collection', coll).eq('doc_id', id);
      assertOk(q.error, 'delete');
    },
    subscribe(coll, cb) {
      const channel = client
        .channel('resumate:' + coll + ':' + Math.random().toString(36).slice(2, 8))
        .on('postgres_changes', { event: '*', schema, table, filter: 'collection=eq.' + coll }, (payload) => {
          const id = payload.eventType === 'DELETE' ? payload.old?.doc_id : payload.new?.doc_id;
          const data = payload.eventType === 'DELETE' ? null : payload.new?.data;
          if (!id) return;
          cb(toType(payload.eventType), id, data, payload);
        })
        .subscribe();
      return () => { client.removeChannel(channel); };
    },
  };
}

/* ---------- Store: thin, backend-agnostic facade used by the rest of the app ---------- */
export const Store = {
  mode: 'none',
  backend: 'none',
  adapter: null as Adapter | null,
  downloads: null as any,
  auth: { provider: 'none', required: false, user: null } as AuthState,
  supabase: null as null | { client: any; schema: string; table: string },
  async init() {
    try {
      const c = (window as any).claude;
      if (c && c.use) {
        const db = await c.use('db'); this.downloads = await c.use('downloads');
        this.adapter = cloudAdapter(db); this.mode = 'cloud'; this.backend = 'cloud'; this.auth = { provider: 'none', required: false, user: null }; return this.mode;
      }
    } catch (e) { /* not running with Claude capabilities; fall through */ }
    if (hasSupabaseConfig()) {
      try {
        const sb = await initSupabase();
        if (!sb) throw new Error('Supabase environment variables are incomplete.');
        this.supabase = sb;
        const sess = await sb.client.auth.getSession();
        if (sess.error) throw new Error(sess.error.message);
        const user = sess.data.session?.user || null;
        if (!user) {
          this.adapter = authRequiredAdapter();
          this.mode = 'auth';
          this.backend = 'supabase';
          this.auth = { provider: 'supabase-google', required: true, user: null };
          return this.mode;
        }
        this.adapter = supabaseAdapter(sb.client, sb.schema, sb.table);
        this.mode = 'supabase';
        this.backend = 'supabase';
        const authUser = {
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.user_metadata?.name || user.email || '',
          avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || user.user_metadata?.image_url || null,
        };
        this.auth = { provider: 'supabase-google', required: false, user: authUser };
        return this.mode;
      } catch (e) {
        throw new Error('Supabase is configured but failed to initialize: ' + ((e && e.message) || 'Unknown error'));
      }
    }
    try {
      if ('indexedDB' in window) {
        const db = await openIdb(); // surface open errors now, not on first use
        this.adapter = idbAdapter(Promise.resolve(db)); this.mode = 'local'; this.backend = 'idb'; this.auth = { provider: 'none', required: false, user: null }; return this.mode;
      }
    } catch (e) { /* IndexedDB unavailable; fall through */ }
    this.adapter = lsAdapter(); this.mode = 'local'; this.backend = 'ls'; this.auth = { provider: 'none', required: false, user: null }; return this.mode;
  },
  async signInWithGoogle() {
    if (!this.supabase) throw new Error('Supabase is not configured.');
    const redirectTo = window.location.origin;
    const r = await this.supabase.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (r.error) throw new Error('Google sign-in failed: ' + r.error.message);
  },
  async signOut() {
    if (!this.supabase) return;
    const r = await this.supabase.client.auth.signOut();
    if (r.error) throw new Error('Sign-out failed: ' + r.error.message);
  },
  async get(coll, id) { return this.adapter.get(coll, id); },
  async list(coll) { return this.adapter.list(coll); },
  async query(coll, field, value) { return (await this.list(coll)).filter((d) => d[field] === value); },
  async put(coll, id, data) { return this.adapter.put(coll, id, data); },
  async del(coll, id) { return this.adapter.del(coll, id); },
  subscribe(coll, cb) { return this.adapter.subscribe ? this.adapter.subscribe(coll, cb) : () => {}; },
};

/* Debounced, retrying write queue with visible status. */
export const Saver = {
  queue: new Map(), timers: new Map(), listeners: new Set(), status: { state: 'idle', at: null, error: '', pending: 0 }, retry: new Map(),
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  _emit(p) { this.status = { ...this.status, ...p, pending: this.queue.size }; this.listeners.forEach((f) => f(this.status)); },
  schedule(coll, id, data, delay = 700) {
    const k = coll + '/' + id; this.queue.set(k, { coll, id, data }); this._emit({ state: 'saving' });
    clearTimeout(this.timers.get(k)); this.timers.set(k, setTimeout(() => this._flushKey(k), delay));
  },
  remove(coll, id) {
    const k = coll + '/' + id; this.queue.delete(k); clearTimeout(this.timers.get(k));
    return Store.del(coll, id);
  },
  async _flushKey(k) {
    const job = this.queue.get(k); if (!job) return;
    try {
      await Store.put(job.coll, job.id, job.data);
      if (this.queue.get(k) === job) this.queue.delete(k);
      else return this._flushKey(k);
      this.retry.delete(k);
      this._emit(this.queue.size ? { state: 'saving' } : { state: 'saved', at: nowISO(), error: '' });
    } catch (e) {
      const tries = (this.retry.get(k) || 0) + 1; this.retry.set(k, tries);
      const msg = e && e.code === 'quota_exceeded' ? 'Storage is full. Delete old versions or resumes.' : e && e.code === 'invalid_argument' ? 'A document is too large to save.' : (e && e.message) || 'Could not save.';
      this._emit({ state: 'error', error: msg });
      if (tries < 4 && !(e && (e.code === 'quota_exceeded' || e.code === 'invalid_argument'))) this.timers.set(k, setTimeout(() => this._flushKey(k), 1500 * tries * tries));
    }
  },
  async flushAll() { const ks = [...this.queue.keys()]; ks.forEach((k) => clearTimeout(this.timers.get(k))); await Promise.all(ks.map((k) => this._flushKey(k))); },
  retryNow() { this.retry.clear(); return this.flushAll(); },
};
window.addEventListener('pagehide', () => { Saver.flushAll(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') Saver.flushAll(); });
