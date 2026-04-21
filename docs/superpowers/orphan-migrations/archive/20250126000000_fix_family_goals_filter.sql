-- Corrigir a função get_family_goals para filtrar apenas objetivos familiares
-- (com family_id NOT NULL)

drop function if exists public.get_family_goals(uuid);

create or replace function public.get_family_goals(p_user_id uuid)
returns setof public.goals
language sql
security definer
set search_path = public
as $$
  select g.* from public.goals g
  where g.family_id is not null
    and g.family_id in (
      select fm.family_id 
      from public.family_members fm 
      where fm.user_id = p_user_id
    );
$$;

-- Garantir permissões
grant execute on function public.get_family_goals(uuid) to authenticated;