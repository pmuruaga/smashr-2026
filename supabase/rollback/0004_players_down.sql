-- Rollback de 0004_players. Borra SOLO lo que creó esa migración (y los jugadores cargados).
-- No toca organizations, matches, sponsors ni ninguna tabla previa.
-- Correr en el SQL Editor de Supabase solo si hay que deshacer la 0004.
begin;
drop function if exists public.admin_share_players(uuid, uuid, uuid[]);
drop table if exists public.org_players;
drop table if exists public.players;            -- arrastra sus triggers e índices
drop function if exists public.players_link_owner();
delete from supabase_migrations.schema_migrations where name = '0004_players';
commit;
