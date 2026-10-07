-- Smashr v2 · esquema inicial multitenant (aplicado en el proyecto Supabase "smashr")
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  brand jsonb not null default '{}'::jsonb,
  rot_sec int not null default 8 check (rot_sec between 3 and 60),
  plan text not null default 'trial',
  created_at timestamptz not null default now()
);
create table public.memberships (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','operator')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null default '',
  image_url text not null,
  active boolean not null default true,
  banner boolean not null default true,
  full_screen boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index sponsors_org_idx on public.sponsors(org_id, sort_order);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  event text not null, event_slug text not null, court text not null, court_slug text not null,
  round text not null default '', category text not null default '', scheduled_at text not null default '',
  teams jsonb not null, preset_key text not null default 'custom', rules jsonb not null, state jsonb not null,
  display jsonb not null default '{"scene":"score"}'::jsonb, h2h jsonb,
  status text not null default 'scheduled' check (status in ('scheduled','live','finished')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index matches_org_status_idx on public.matches(org_id, status);
create index matches_board_idx on public.matches(org_id, event_slug, court_slug);
create table public.match_events (
  id bigserial primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null, team smallint, state_before jsonb not null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index match_events_match_idx on public.match_events(match_id, id desc);
create index match_events_org_idx on public.match_events(org_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger matches_touch before update on public.matches for each row execute function public.touch_updated_at();

create or replace function public.is_member(o uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships m where m.org_id = o and m.user_id = (select auth.uid()));
$$;
revoke execute on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;

create or replace function public.create_organization(p_name text, p_slug text) returns public.organizations
language plpgsql security definer set search_path = '' as $$
declare o public.organizations;
begin
  if (select auth.uid()) is null then raise exception 'No autenticado'; end if;
  insert into public.organizations(name, slug) values (trim(p_name), p_slug) returning * into o;
  insert into public.memberships(org_id, user_id, role) values (o.id, (select auth.uid()), 'owner');
  return o;
end $$;
revoke execute on function public.create_organization(text,text) from public, anon;
grant execute on function public.create_organization(text,text) to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships  enable row level security;
alter table public.sponsors     enable row level security;
alter table public.matches      enable row level security;
alter table public.match_events enable row level security;
create policy org_read_public on public.organizations for select using (true);
create policy org_update_members on public.organizations for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
create policy membership_read_own on public.memberships for select to authenticated using (user_id = (select auth.uid()));
create policy sponsors_read_public on public.sponsors for select using (true);
create policy sponsors_write_members on public.sponsors for all to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy matches_read_public on public.matches for select using (true);
create policy matches_write_members on public.matches for all to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy events_members on public.match_events for all to authenticated using (public.is_member(org_id)) with check (public.is_member(org_id));

alter publication supabase_realtime add table public.matches, public.sponsors, public.organizations;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets','brand-assets', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do nothing;
create policy assets_insert_members on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-assets' and (storage.foldername(name))[1] = 'orgs' and public.is_member(((storage.foldername(name))[2])::uuid));
create policy assets_update_members on storage.objects for update to authenticated
  using (bucket_id = 'brand-assets' and public.is_member(((storage.foldername(name))[2])::uuid));
create policy assets_delete_members on storage.objects for delete to authenticated
  using (bucket_id = 'brand-assets' and public.is_member(((storage.foldername(name))[2])::uuid));
