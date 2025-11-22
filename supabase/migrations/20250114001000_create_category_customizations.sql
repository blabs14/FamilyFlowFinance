-- Create table for user-specific category customizations
-- Ensures table exists before RLS policies referencing it (e.g., 20250115000200_rls_personal_area_isolation.sql)

create table if not exists "public"."category_customizations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "category_id" uuid not null,
    "custom_color" text,
    "custom_icon" text,
    "custom_name" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);

-- Enable RLS; policies are defined in later migrations
alter table "public"."category_customizations" enable row level security;

-- Primary key
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'category_customizations_pkey'
  ) then
    create unique index category_customizations_pkey on public.category_customizations using btree (id);
    alter table "public"."category_customizations" add constraint "category_customizations_pkey" primary key using index "category_customizations_pkey";
  end if;
end $$;

-- Unique constraint to support upsert on (user_id, category_id)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'category_customizations_user_category_key'
  ) then
    create unique index category_customizations_user_category_key on public.category_customizations using btree (user_id, category_id);
  end if;
end $$;

-- Foreign keys
do $$
begin
  -- Link to categories
  if not exists (
    select 1 from pg_constraint
    where conname = 'category_customizations_category_id_fkey'
  ) then
    alter table "public"."category_customizations"
      add constraint "category_customizations_category_id_fkey"
      foreign key (category_id) references public.categories(id) on delete cascade not valid;
    alter table "public"."category_customizations" validate constraint "category_customizations_category_id_fkey";
  end if;

  -- Link to users (consistent with other tables using auth.users)
  if not exists (
    select 1 from pg_constraint
    where conname = 'category_customizations_user_id_fkey'
  ) then
    alter table "public"."category_customizations"
      add constraint "category_customizations_user_id_fkey"
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
    alter table "public"."category_customizations" validate constraint "category_customizations_user_id_fkey";
  end if;
end $$;

comment on table public.category_customizations is 'User-specific customizations for default categories (color/icon/name)';