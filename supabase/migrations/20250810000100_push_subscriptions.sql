-- Push subscriptions table
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- RLS
alter table public.push_subscriptions enable row level security;

do $$ begin
  create policy "Users manage own push subscriptions"
    on public.push_subscriptions
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$; 