create schema if not exists resumate;

create table if not exists resumate.docs (
  owner_id uuid not null default auth.uid(),
  collection text not null,
  doc_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, collection, doc_id)
);

alter table resumate.docs enable row level security;

drop policy if exists "resumate_docs_select_own" on resumate.docs;
create policy "resumate_docs_select_own"
  on resumate.docs
  for select
  to authenticated
  using (owner_id = auth.uid());

drop policy if exists "resumate_docs_insert_own" on resumate.docs;
create policy "resumate_docs_insert_own"
  on resumate.docs
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "resumate_docs_update_own" on resumate.docs;
create policy "resumate_docs_update_own"
  on resumate.docs
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "resumate_docs_delete_own" on resumate.docs;
create policy "resumate_docs_delete_own"
  on resumate.docs
  for delete
  to authenticated
  using (owner_id = auth.uid());

alter publication supabase_realtime add table resumate.docs;
