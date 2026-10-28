-- Smashr v2 · 0005 · Ranking por club
-- Aditivo: agrega 2 columnas vacías a org_players (no toca datos existentes).
-- Por ahora se cargan a mano; más adelante se podrán calcular (p. ej. con estadísticas).
alter table public.org_players
  add column ranking        int check (ranking > 0),                     -- puesto (#12)
  add column ranking_points int not null default 0 check (ranking_points >= 0); -- puntos
grant update (ranking, ranking_points) on public.org_players to authenticated;

-- Al compartir, la org destino arranca también con el ranking de la org origen
create or replace function public.admin_share_players(p_from uuid, p_to uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_app_admin() then raise exception 'No autorizado'; end if;
  insert into public.org_players(org_id, player_id, category, position, ranking, ranking_points)
    select p_to, op.player_id, op.category, op.position, op.ranking, op.ranking_points
    from public.org_players op
    join public.players p on p.id = op.player_id and p.owner_org_id = p_from
    where op.org_id = p_from and (p_ids is null or op.player_id = any(p_ids))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
