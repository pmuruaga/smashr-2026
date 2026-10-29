-- Rollback de 0005_player_ranking: quita las 2 columnas de ranking y deja la función de compartir como en 0004.
begin;
create or replace function public.admin_share_players(p_from uuid, p_to uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.is_app_admin() then raise exception 'No autorizado'; end if;
  insert into public.org_players(org_id, player_id, category, position)
    select p_to, op.player_id, op.category, op.position
    from public.org_players op
    join public.players p on p.id = op.player_id and p.owner_org_id = p_from
    where op.org_id = p_from and (p_ids is null or op.player_id = any(p_ids))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
alter table public.org_players drop column if exists ranking, drop column if exists ranking_points;
delete from supabase_migrations.schema_migrations where name = '0005_player_ranking';
commit;
