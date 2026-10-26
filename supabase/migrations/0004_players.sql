-- Smashr v2 · 0004 · Jugadores por organización
-- Cambio 100 % aditivo: crea 2 tablas, 2 funciones y 1 trigger nuevos.
-- No modifica ni borra nada existente (matches.teams sigue igual; el vínculo
-- partido ↔ jugador se hará guardando player_id dentro del jsonb de teams).

-- 1) Jugadores ---------------------------------------------------------------
create table public.players (
  id            uuid primary key default gen_random_uuid(),
  -- Si se borra la org dueña, el jugador NO se borra: queda sin dueño (null)
  -- y lo siguen viendo las demás orgs con las que estaba compartido.
  owner_org_id  uuid references public.organizations(id) on delete set null,
  first_name    text not null check (length(trim(first_name)) > 0),
  last_name     text not null check (length(trim(last_name)) > 0),
  dni           text check (dni ~ '^[0-9]{6,9}$'),            -- opcional, solo dígitos
  city          text not null default '',
  gender        text check (gender in ('M','F','X')),
  category      text not null default '',                     -- libre: '4ta', '7ma', 'Suma 12'…
  hand          text check (hand in ('derecha','izquierda')),
  position      text check (position in ('drive','reves','ambas')),
  birth_date    date check (birth_date >= '1900-01-01'),
  photo_url     text,                                         -- brand-assets/orgs/{org_id}/players/…
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- El DNI no se repite dentro de la misma organización dueña (sí puede repetirse entre orgs)
create unique index players_owner_dni_uq on public.players(owner_org_id, dni) where dni is not null;
create index players_owner_idx on public.players(owner_org_id);
create index players_name_idx  on public.players(owner_org_id, lower(last_name), lower(first_name));
create trigger players_touch before update on public.players
  for each row execute function public.touch_updated_at();

-- 2) Qué organizaciones ven cada jugador --------------------------------------
-- Si se borra una org, solo se borran SUS vínculos; el jugador sigue existiendo.
create table public.org_players (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (org_id, player_id)
);
create index org_players_player_idx on public.org_players(player_id);

-- Al crear un jugador, la org dueña queda vinculada automáticamente
create or replace function public.players_link_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.org_players(org_id, player_id) values (new.owner_org_id, new.id)
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.players_link_owner() from public, anon, authenticated;
create trigger players_link_owner after insert on public.players
  for each row execute function public.players_link_owner();

-- 3) Seguridad (RLS) ----------------------------------------------------------
-- Sin lectura pública: el tablero sigue leyendo los nombres desde matches.teams,
-- así el DNI y la fecha de nacimiento nunca quedan expuestos.
alter table public.players     enable row level security;
alter table public.org_players enable row level security;

create policy players_read_linked on public.players for select to authenticated
  using (exists (select 1 from public.org_players op
                 where op.player_id = players.id and public.is_member(op.org_id)));
create policy players_insert_owner on public.players for insert to authenticated
  with check (public.is_member(owner_org_id));
create policy players_update_owner on public.players for update to authenticated
  using (public.is_member(owner_org_id)) with check (public.is_member(owner_org_id));
create policy players_delete_owner on public.players for delete to authenticated
  using (public.is_member(owner_org_id));

create policy org_players_read_members on public.org_players for select to authenticated
  using (public.is_member(org_id));
-- Sin políticas de insert/delete: compartir con otra org solo vía la función de admin.

-- 4) Compartir jugadores con otra org (solo superusuario) ---------------------
-- Uso: select public.admin_share_players('<org_origen>', '<org_destino>');          -- todos
--      select public.admin_share_players('<org_origen>', '<org_destino>', array['<id>']::uuid[]);
create or replace function public.admin_share_players(p_from uuid, p_to uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_app_admin() then raise exception 'No autorizado'; end if;
  insert into public.org_players(org_id, player_id)
    select p_to, p.id from public.players p
    where p.owner_org_id = p_from and (p_ids is null or p.id = any(p_ids))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.admin_share_players(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.admin_share_players(uuid, uuid, uuid[]) to authenticated;
