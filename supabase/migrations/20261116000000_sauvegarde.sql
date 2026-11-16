-- Sauvegarde en ligne : la partie suit le pseudo et son code secret.
--
-- Une sauvegarde par joueur (la partie en cours, pas le record : le record reste dans scores).
-- Lecture et écriture seulement par les fonctions load_game et save_game, qui vérifient le code
-- (même blocage après 5 mauvais codes que le classement).
--
-- Deux appareils sur le même pseudo : chaque sauvegarde porte un numéro de révision. Un appareil
-- envoie la révision qu'il connaît ; si quelqu'un a sauvegardé entre-temps ailleurs, le serveur
-- répond « conflict » au lieu d'écraser, et le jeu demande au joueur quelle partie garder.
--
-- À exécuter une fois dans Supabase : SQL Editor → coller ce fichier → Run (après le fichier du classement).
-- Le fichier peut être relancé sans danger.

create table if not exists public.saves (
  player_id uuid primary key references public.players (id) on delete cascade,
  data jsonb not null,
  revision integer not null default 1,
  total_earned double precision not null default 0,
  tier_index smallint not null default 0,
  character_id text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;
revoke all on public.saves from anon, authenticated;

alter table public.players add column if not exists last_save_at timestamptz;

-- ---- Charger sa partie ------------------------------------------------------
-- Réponse : { status: 'ok', save: {...} | null, revision, total_earned, tier_index, character_id, updated_at }
--        ou { status: 'wrong_code' | 'locked' | 'unknown_player' }

create or replace function public.load_game(p_pseudo text, p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players;
  v_check json;
  v_save public.saves;
begin
  select * into v_player from public.players where pseudo_key = lower(btrim(coalesce(p_pseudo, '')));
  if not found then
    return json_build_object('status', 'unknown_player');
  end if;
  v_check := public._check_player_code(v_player.id, coalesce(p_code, ''));
  if v_check->>'status' <> 'ok' then return v_check; end if;

  select * into v_save from public.saves where player_id = v_player.id;
  if v_save.player_id is null then
    return json_build_object('status', 'ok', 'save', null, 'revision', 0);
  end if;
  return json_build_object(
    'status', 'ok',
    'save', v_save.data,
    'revision', v_save.revision,
    'total_earned', v_save.total_earned,
    'tier_index', v_save.tier_index,
    'character_id', v_save.character_id,
    'updated_at', v_save.updated_at
  );
end;
$$;

-- ---- Sauvegarder sa partie --------------------------------------------------
-- p_revision : la révision que l'appareil a chargée ou écrite en dernier (0 = aucune).
-- Réponse : { status: 'ok', revision }
--        ou { status: 'conflict', revision, total_earned, tier_index, character_id, updated_at }
--        ou { status: 'too_soon' | 'invalid_save' | 'wrong_code' | 'locked' | 'unknown_player' }

create or replace function public.save_game(
  p_pseudo text,
  p_code text,
  p_save jsonb,
  p_revision integer,
  p_total_earned double precision default 0,
  p_tier_index integer default 0,
  p_character text default ''
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players;
  v_check json;
  v_save public.saves;
begin
  select * into v_player from public.players where pseudo_key = lower(btrim(coalesce(p_pseudo, '')));
  if not found then
    return json_build_object('status', 'unknown_player');
  end if;
  v_check := public._check_player_code(v_player.id, coalesce(p_code, ''));
  if v_check->>'status' <> 'ok' then return v_check; end if;

  if v_player.last_save_at is not null and v_player.last_save_at > now() - interval '10 seconds' then
    return json_build_object('status', 'too_soon');
  end if;

  if p_save is null or jsonb_typeof(p_save) <> 'object' or octet_length(p_save::text) > 65536
     or coalesce(jsonb_typeof(p_save->'version'), '') <> 'number'
     or p_revision is null or p_revision < 0
     or p_total_earned is null or p_total_earned < 0 or p_total_earned > 1e300 or p_total_earned = 'NaN'::double precision
     or coalesce(p_tier_index, 0) not between 0 and 99
     or coalesce(p_character, '') !~ '^[a-z0-9-]{0,32}$' then
    return json_build_object('status', 'invalid_save');
  end if;

  update public.players set last_save_at = now() where id = v_player.id;

  select * into v_save from public.saves where player_id = v_player.id for update;
  if v_save.player_id is null then
    -- Première sauvegarde (ou sauvegarde supprimée entre-temps) : on repart de la révision 1.
    insert into public.saves (player_id, data, revision, total_earned, tier_index, character_id)
    values (v_player.id, p_save, 1, p_total_earned, coalesce(p_tier_index, 0), coalesce(p_character, ''));
    return json_build_object('status', 'ok', 'revision', 1);
  end if;

  if v_save.revision <> p_revision then
    return json_build_object(
      'status', 'conflict',
      'revision', v_save.revision,
      'total_earned', v_save.total_earned,
      'tier_index', v_save.tier_index,
      'character_id', v_save.character_id,
      'updated_at', v_save.updated_at
    );
  end if;

  update public.saves
     set data = p_save, revision = v_save.revision + 1, total_earned = p_total_earned,
         tier_index = coalesce(p_tier_index, 0), character_id = coalesce(p_character, ''), updated_at = now()
   where player_id = v_player.id;
  return json_build_object('status', 'ok', 'revision', v_save.revision + 1);
end;
$$;

revoke all on function public.load_game(text, text) from public;
revoke all on function public.save_game(text, text, jsonb, integer, double precision, integer, text) from public;
grant execute on function public.load_game(text, text) to anon, authenticated;
grant execute on function public.save_game(text, text, jsonb, integer, double precision, integer, text) to anon, authenticated;
