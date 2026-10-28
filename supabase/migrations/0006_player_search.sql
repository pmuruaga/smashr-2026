-- Smashr v2 · 0006 · Búsqueda y paginación de jugadores en la base
-- Aditivo: solo crea funciones e índices. No modifica tablas ni datos.
-- La app deja de traer todos los jugadores y pide solo la página/resultados que muestra.

-- Normaliza texto para buscar sin tildes ni mayúsculas ("Gómez" = "gomez")
create or replace function public.norm_txt(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(translate(coalesce(t, ''), 'ÁÉÍÓÚÜÑÀÈÌÒÙáéíóúüñàèìòù', 'AEIOUUNAEIOUaeiouunaeiou'));
$$;

-- Busca jugadores de una org, paginado. Corre con los permisos del usuario (RLS aplica igual).
--  p_q          texto libre: cada palabra tiene que aparecer en nombre, apellido, DNI, ciudad o categoría
--  p_category   filtra por categoría exacta (null/'' = todas)
--  p_prefer_cat categoría del partido: esos jugadores salen primero (buscador de Nuevo partido)
--  p_exclude    ids a excluir (los ya elegidos en el partido)
--  total        cantidad total que cumple el filtro (para el paginador)
create or replace function public.search_org_players(
  p_org uuid, p_q text default '', p_category text default null,
  p_limit int default 25, p_offset int default 0,
  p_prefer_cat text default null, p_exclude uuid[] default null)
returns table (
  id uuid, owner_org_id uuid, first_name text, last_name text, dni text, city text, gender text, hand text,
  birth_date date, photo_url text, category text, "position" text, ranking int, ranking_points int, total bigint)
language sql stable security invoker set search_path = '' as $$
  with words as (
    select w from unnest(regexp_split_to_array(public.norm_txt(trim(coalesce(p_q, ''))), '\s+')) w where w <> ''
  ), base as (
    select p.id, p.owner_org_id, p.first_name, p.last_name, p.dni, p.city, p.gender, p.hand, p.birth_date, p.photo_url,
           op.category, op.position, op.ranking, op.ranking_points,
           (coalesce(p_prefer_cat, '') <> '' and op.category <> ''
             and strpos(public.norm_txt(p_prefer_cat), public.norm_txt(op.category)) > 0) as preferred
    from public.org_players op
    join public.players p on p.id = op.player_id
    where op.org_id = p_org
      and (coalesce(p_category, '') = '' or op.category = p_category)
      and (p_exclude is null or not (p.id = any(p_exclude)))
      and not exists (
        select 1 from words
        where strpos(public.norm_txt(p.first_name || ' ' || p.last_name || ' ' || coalesce(p.dni, '') || ' ' || p.city || ' ' || op.category), words.w) = 0)
  )
  select b.id, b.owner_org_id, b.first_name, b.last_name, b.dni, b.city, b.gender, b.hand, b.birth_date, b.photo_url,
         b.category, b.position, b.ranking, b.ranking_points, count(*) over () as total
  from base b
  order by b.preferred desc, public.norm_txt(b.last_name), public.norm_txt(b.first_name), b.id
  limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke execute on function public.search_org_players(uuid, text, text, int, int, text, uuid[]) from public, anon;
grant execute on function public.search_org_players(uuid, text, text, int, int, text, uuid[]) to authenticated;

-- Categorías usadas por la org (para el filtro), sin traer los jugadores
create or replace function public.org_player_categories(p_org uuid) returns setof text
language sql stable security invoker set search_path = '' as $$
  select distinct op.category from public.org_players op where op.org_id = p_org and op.category <> '' order by 1;
$$;
revoke execute on function public.org_player_categories(uuid) from public, anon;
grant execute on function public.org_player_categories(uuid) to authenticated;

-- Índice para ordenar/paginar el listado por org
create index if not exists org_players_org_cat_idx on public.org_players(org_id, category);
