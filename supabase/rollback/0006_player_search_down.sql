-- Rollback de 0006_player_search: borra solo las funciones e índice que creó.
begin;
drop function if exists public.search_org_players(uuid, text, text, int, int, text, uuid[]);
drop function if exists public.org_player_categories(uuid);
drop function if exists public.norm_txt(text);
drop index if exists public.org_players_org_cat_idx;
delete from supabase_migrations.schema_migrations where name = '0006_player_search';
commit;
