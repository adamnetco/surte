create or replace function public.get_current_user_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.user_roles
      where user_id = auth.uid()
      order by case role
        when 'superadmin' then 1
        when 'admin' then 2
        when 'editor' then 3
        when 'agente' then 4
        when 'user' then 5
        else 6
      end
      limit 1
    ),
    'user'::app_role
  )
$$;