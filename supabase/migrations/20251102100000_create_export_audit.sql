-- Create table for export audits (idempotent)
create table if not exists public.export_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  format text not null check (format in ('csv','pdf')),
  count integer not null check (count >= 1),
  filters jsonb null,
  duration_ms integer not null,
  size_bytes integer not null,
  status text not null check (status in ('success','failed')),
  file_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists export_audit_created_at_idx on public.export_audit (created_at desc);
create index if not exists export_audit_user_id_created_idx on public.export_audit (user_id, created_at desc);

alter table public.export_audit enable row level security;

create policy if not exists export_audit_owner_select on public.export_audit
for select using (auth.uid() = user_id);

create policy if not exists export_audit_owner_insert on public.export_audit
for insert with check (auth.uid() = user_id);