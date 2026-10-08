-- Direcciones reservadas por rutas de la app
alter table public.organizations add constraint org_slug_reserved
  check (slug not in ('panel','login','registro','auth','t','onboarding','api','admin','hoy','_next'));

-- Superusuarios (por email, así sirve aunque todavía no se haya registrado)
create table public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security; -- sin políticas: solo se usa desde funciones
insert into public.app_admins(email) values ('pmuruaga@gmail.com') on conflict do nothing;

create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.app_admins a where lower(a.email) = lower((select auth.jwt()->>'email')));
$$;
revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

create or replace function public.admin_list_users()
returns table(id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, active boolean, orgs text, is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'No autorizado'; end if;
  return query
    select u.id, u.email::text, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at is not null,
           (u.banned_until is null or u.banned_until < now()),
           coalesce(string_agg(o.name, ', ' order by o.name), ''),
           exists(select 1 from public.app_admins a where lower(a.email) = lower(u.email))
    from auth.users u
    left join public.memberships m on m.user_id = u.id
    left join public.organizations o on o.id = m.org_id
    group by u.id
    order by u.created_at desc;
end $$;
revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

create or replace function public.admin_set_user_active(p_user uuid, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_app_admin() then raise exception 'No autorizado'; end if;
  if p_user = (select auth.uid()) then raise exception 'No podés desactivar tu propio usuario'; end if;
  update auth.users set banned_until = case when p_active then null else 'infinity'::timestamptz end where id = p_user;
  if not p_active then delete from auth.sessions where user_id = p_user; end if;
end $$;
revoke execute on function public.admin_set_user_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_active(uuid, boolean) to authenticated;
