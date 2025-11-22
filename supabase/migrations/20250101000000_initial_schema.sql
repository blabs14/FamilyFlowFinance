-- Initial schema migration based on production database

-- Create profiles table
create table "public"."profiles" (
    "id" uuid not null,
    "updated_at" timestamp with time zone,
    "username" text,
    "full_name" text,
    "avatar_url" text,
    "website" text,
    "family_id" uuid
);

alter table "public"."profiles" enable row level security;

-- Create categories table
create table "public"."categories" (
    "id" uuid not null default gen_random_uuid(),
    "nome" text not null,
    "cor" text default '#3B82F6'::text,
    "created_at" timestamp with time zone default now(),
    "user_id" uuid,
    "family_id" uuid
);

alter table "public"."categories" enable row level security;

-- Create accounts table
create table "public"."accounts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "nome" text not null,
    "tipo" text not null,
    "created_at" timestamp with time zone default now(),
    "saldo" numeric(15,2) default 0.00,
    "family_id" uuid
);

alter table "public"."accounts" enable row level security;

-- Create transactions table
create table "public"."transactions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "account_id" uuid not null,
    "categoria_id" uuid not null,
    "valor" numeric(15,2) not null,
    "descricao" text not null,
    "data" date not null,
    "created_at" timestamp with time zone default now(),
    "tipo" text not null,
    "family_id" uuid
);

alter table "public"."transactions" enable row level security;

-- Create goals table
create table "public"."goals" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "nome" text not null,
    "valor_objetivo" numeric(15,2) not null,
    "valor_atual" numeric(15,2) default 0.00,
    "data_objetivo" date,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "family_id" uuid
);

alter table "public"."goals" enable row level security;

-- Create goal_allocations table
create table "public"."goal_allocations" (
    "id" uuid not null default gen_random_uuid(),
    "goal_id" uuid not null,
    "transaction_id" uuid not null,
    "valor" numeric(15,2) not null,
    "created_at" timestamp with time zone default now()
);

alter table "public"."goal_allocations" enable row level security;

-- Create budgets table
create table "public"."budgets" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "categoria_id" uuid not null,
    "valor" numeric(15,2) not null,
    "mes" character varying(7) not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "family_id" uuid
);

alter table "public"."budgets" enable row level security;

-- Create notifications table
create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "titulo" text not null,
    "mensagem" text not null,
    "tipo" text not null,
    "lida" boolean default false,
    "created_at" timestamp with time zone default now(),
    "family_id" uuid
);

alter table "public"."notifications" enable row level security;

-- Create families table
create table "public"."families" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "created_by" uuid not null
);

alter table "public"."families" enable row level security;

-- Create family_members table
create table "public"."family_members" (
    "id" uuid not null default gen_random_uuid(),
    "family_id" uuid not null,
    "user_id" uuid not null,
    "role" text default 'member'::text,
    "joined_at" timestamp with time zone default now(),
    "invited_by" uuid
);

alter table "public"."family_members" enable row level security;

-- Create audit_logs table
create table "public"."audit_logs" (
    "id" uuid not null default gen_random_uuid(),
    "timestamp" timestamp with time zone not null default now(),
    "user_id" uuid,
    "operation" text not null,
    "table_name" text not null,
    "row_id" uuid,
    "old_data" jsonb,
    "new_data" jsonb,
    "details" jsonb,
    "ip_address" text
);

alter table "public"."audit_logs" enable row level security;

-- Add primary keys
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id);
CREATE UNIQUE INDEX accounts_pkey ON public.accounts USING btree (id);
CREATE UNIQUE INDEX transactions_pkey ON public.transactions USING btree (id);
CREATE UNIQUE INDEX goals_pkey ON public.goals USING btree (id);
CREATE UNIQUE INDEX goal_allocations_pkey ON public.goal_allocations USING btree (id);
CREATE UNIQUE INDEX budgets_pkey ON public.budgets USING btree (id);
CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);
CREATE UNIQUE INDEX families_pkey ON public.families USING btree (id);
CREATE UNIQUE INDEX family_members_pkey ON public.family_members USING btree (id);
CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";
alter table "public"."categories" add constraint "categories_pkey" PRIMARY KEY using index "categories_pkey";
alter table "public"."accounts" add constraint "accounts_pkey" PRIMARY KEY using index "accounts_pkey";
alter table "public"."transactions" add constraint "transactions_pkey" PRIMARY KEY using index "transactions_pkey";
alter table "public"."goals" add constraint "goals_pkey" PRIMARY KEY using index "goals_pkey";
alter table "public"."goal_allocations" add constraint "goal_allocations_pkey" PRIMARY KEY using index "goal_allocations_pkey";
alter table "public"."budgets" add constraint "budgets_pkey" PRIMARY KEY using index "budgets_pkey";
alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";
alter table "public"."families" add constraint "families_pkey" PRIMARY KEY using index "families_pkey";
alter table "public"."family_members" add constraint "family_members_pkey" PRIMARY KEY using index "family_members_pkey";
alter table "public"."audit_logs" add constraint "audit_logs_pkey" PRIMARY KEY using index "audit_logs_pkey";

-- Add foreign key constraints
alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."accounts" add constraint "accounts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."accounts" validate constraint "accounts_user_id_fkey";

alter table "public"."transactions" add constraint "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."transactions" validate constraint "transactions_user_id_fkey";

alter table "public"."transactions" add constraint "transactions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE not valid;
alter table "public"."transactions" validate constraint "transactions_account_id_fkey";

alter table "public"."transactions" add constraint "transactions_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;
alter table "public"."transactions" validate constraint "transactions_categoria_id_fkey";

alter table "public"."goals" add constraint "goals_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."goals" validate constraint "goals_user_id_fkey";

alter table "public"."goal_allocations" add constraint "goal_allocations_goal_id_fkey" FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE not valid;
alter table "public"."goal_allocations" validate constraint "goal_allocations_goal_id_fkey";

alter table "public"."goal_allocations" add constraint "goal_allocations_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE not valid;
alter table "public"."goal_allocations" validate constraint "goal_allocations_transaction_id_fkey";

alter table "public"."budgets" add constraint "budgets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."budgets" validate constraint "budgets_user_id_fkey";

alter table "public"."budgets" add constraint "budgets_categoria_id_fkey" FOREIGN KEY (categoria_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;
alter table "public"."budgets" validate constraint "budgets_categoria_id_fkey";

alter table "public"."notifications" add constraint "notifications_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."notifications" validate constraint "notifications_user_id_fkey";

alter table "public"."families" add constraint "families_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."families" validate constraint "families_created_by_fkey";

alter table "public"."family_members" add constraint "family_members_family_id_fkey" FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE not valid;
alter table "public"."family_members" validate constraint "family_members_family_id_fkey";

alter table "public"."family_members" add constraint "family_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;
alter table "public"."family_members" validate constraint "family_members_user_id_fkey";

alter table "public"."family_members" add constraint "family_members_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) not valid;
alter table "public"."family_members" validate constraint "family_members_invited_by_fkey";