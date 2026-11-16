-- Classement « Temps réel » et page « Carrière de l'artiste » : les stats publiques de la partie en cours.
--
-- La sauvegarde en ligne (table saves) reste illisible : elle contient toute la partie. On publie
-- à côté, dans live_stats, seulement quelques chiffres (cash, $/s, abonnés, beats/s, territoires,
-- serre, animaux...), lisibles par tout le monde. Ni le code, ni la sauvegarde n'y sont.
--
-- live_stats s'écrit seulement par save_game, qui reçoit maintenant un paramètre p_stats en plus.
-- Les stats ne sont publiées que si la sauvegarde passe : un appareil en retard (« conflict »)
-- n'écrase pas les stats de la partie la plus récente. Des stats invalides n'empêchent pas la
-- sauvegarde : elles sont ignorées (réponse stats = 'invalid').
-- Les mêmes règles sont dans le jeu : src/online/rules.js (cleanLiveStats), testées par npm test.
--
-- À exécuter une fois dans Supabase : SQL Editor → coller ce fichier → Run
-- (après 20261115000000_classement.sql et 20261116000000_sauvegarde.sql).
-- Le fichier peut être relancé sans danger. Si on relance le fichier de la sauvegarde, relancer
-- celui-ci ensuite (il remplace save_game).

-- ---- Stats publiques de la partie en cours ---------------------------------

create table if not exists public.live_stats (
  player_id uuid primary key references public.players (id) on delete cascade,
  pseudo text not null,
  character_id text not null default '',
  money double precision not null default 0 check (money >= 0),
  income double precision not null default 0 check (income >= 0),
  total_earned double precision not null default 0 check (total_earned >= 0),
  tier_index smallint not null default 0 check (tier_index between 0 and 99),
  fans double precision not null default 0 check (fans >= 0),
  bps double precision not null default 0 check (bps >= 0),
  total_beats double precision not null default 0 check (total_beats >= 0),
  territories smallint not null default 0 check (territories between 0 and 999),
  greenhouse boolean not null default false,
  total_grams double precision not null default 0 check (total_grams >= 0),
  pets jsonb not null default '{}'::jsonb,
  companion text not null default '',
  fail_out boolean not null default false,
  played_seconds double precision not null default 0 check (played_seconds >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists live_stats_income_idx on public.live_stats (income desc);

alter table public.live_stats enable row level security;
drop policy if exists "temps réel lisible par tous" on public.live_stats;
create policy "temps réel lisible par tous" on public.live_stats for select to anon, authenticated using (true);
revoke all on public.live_stats from anon, authenticated;
grant select on public.live_stats to anon, authenticated;

-- ---- Vérification des stats (interne) ---------------------------------------

-- Nombre JSON entre lo et hi (entier si whole). Champ absent (null SQL) : accepté, valeur par défaut.
create or replace function public._json_number_ok(v jsonb, lo numeric, hi numeric, whole boolean default false)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v is null then return true; end if;
  if jsonb_typeof(v) <> 'number' then return false; end if;
  return v::numeric between lo and hi and (not whole or v::numeric = trunc(v::numeric));
end;
$$;

create or replace function public._live_stats_ok(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 4096 then return false; end if;
  foreach k in array array['money', 'income', 'fans', 'bps', 'total_beats', 'total_grams', 'played_seconds'] loop
    if not public._json_number_ok(p->k, 0, 1e300) then return false; end if;
  end loop;
  if not public._json_number_ok(p->'territories', 0, 999, true) then return false; end if;
  foreach k in array array['greenhouse', 'fail_out'] loop
    if p ? k and jsonb_typeof(p->k) <> 'boolean' then return false; end if;
  end loop;
  if p ? 'companion' and (jsonb_typeof(p->'companion') <> 'string' or p->>'companion' !~ '^[a-z0-9-]{0,32}$') then
    return false;
  end if;
  if p ? 'pets' then
    if jsonb_typeof(p->'pets') <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(p->'pets')) > 32 then return false; end if;
    for k, v in select e.key, e.value from jsonb_each(p->'pets') as e loop
      if k !~ '^[a-z0-9-]{1,32}$' or not public._json_number_ok(v, 0, 9999, true) then
        return false;
      end if;
    end loop;
  end if;
  return true;
end;
$$;

revoke all on function public._json_number_ok(jsonb, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function public._live_stats_ok(jsonb) from public, anon, authenticated;

-- ---- Sauvegarder sa partie (remplace la version de 20261116000000_sauvegarde.sql) ----
-- Même chose qu'avant, plus p_stats (facultatif) : les stats publiques de cette partie.
-- Réponse : { status: 'ok', revision, stats?: 'ok' | 'invalid' } (stats seulement si p_stats est envoyé)
--        ou { status: 'conflict', revision, total_earned, tier_index, character_id, updated_at }
--        ou { status: 'too_soon' | 'invalid_save' | 'wrong_code' | 'locked' | 'unknown_player' }

-- L'ancienne version (sans p_stats) est retirée : deux versions rendraient l'appel ambigu.
drop function if exists public.save_game(text, text, jsonb, integer, double precision, integer, text);

create or replace function public.save_game(
  p_pseudo text,
  p_code text,
  p_save jsonb,
  p_revision integer,
  p_total_earned double precision default 0,
  p_tier_index integer default 0,
  p_character text default '',
  p_stats jsonb default null
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
  v_revision integer;
  v_stats text;
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
    v_revision := 1;
  elsif v_save.revision <> p_revision then
    return json_build_object(
      'status', 'conflict',
      'revision', v_save.revision,
      'total_earned', v_save.total_earned,
      'tier_index', v_save.tier_index,
      'character_id', v_save.character_id,
      'updated_at', v_save.updated_at
    );
  else
    update public.saves
       set data = p_save, revision = v_save.revision + 1, total_earned = p_total_earned,
           tier_index = coalesce(p_tier_index, 0), character_id = coalesce(p_character, ''), updated_at = now()
     where player_id = v_player.id;
    v_revision := v_save.revision + 1;
  end if;

  if p_stats is null then
    return json_build_object('status', 'ok', 'revision', v_revision);
  end if;

  if public._live_stats_ok(p_stats) then
    insert into public.live_stats (
      player_id, pseudo, character_id, money, income, total_earned, tier_index, fans, bps, total_beats,
      territories, greenhouse, total_grams, pets, companion, fail_out, played_seconds, updated_at
    ) values (
      v_player.id, v_player.pseudo, coalesce(p_character, ''),
      coalesce((p_stats->>'money')::double precision, 0),
      coalesce((p_stats->>'income')::double precision, 0),
      p_total_earned,
      coalesce(p_tier_index, 0),
      coalesce((p_stats->>'fans')::double precision, 0),
      coalesce((p_stats->>'bps')::double precision, 0),
      coalesce((p_stats->>'total_beats')::double precision, 0),
      coalesce((p_stats->>'territories')::smallint, 0),
      coalesce((p_stats->>'greenhouse')::boolean, false),
      coalesce((p_stats->>'total_grams')::double precision, 0),
      coalesce(p_stats->'pets', '{}'::jsonb),
      coalesce(p_stats->>'companion', ''),
      coalesce((p_stats->>'fail_out')::boolean, false),
      coalesce((p_stats->>'played_seconds')::double precision, 0),
      now()
    )
    on conflict (player_id) do update set
      pseudo = excluded.pseudo, character_id = excluded.character_id, money = excluded.money,
      income = excluded.income, total_earned = excluded.total_earned, tier_index = excluded.tier_index,
      fans = excluded.fans, bps = excluded.bps, total_beats = excluded.total_beats,
      territories = excluded.territories, greenhouse = excluded.greenhouse, total_grams = excluded.total_grams,
      pets = excluded.pets, companion = excluded.companion, fail_out = excluded.fail_out,
      played_seconds = excluded.played_seconds, updated_at = excluded.updated_at;
    v_stats := 'ok';
  else
    v_stats := 'invalid';
  end if;
  return json_build_object('status', 'ok', 'revision', v_revision, 'stats', v_stats);
end;
$$;

revoke all on function public.save_game(text, text, jsonb, integer, double precision, integer, text, jsonb) from public;
grant execute on function public.save_game(text, text, jsonb, integer, double precision, integer, text, jsonb) to anon, authenticated;

-- ---- Temps réel : l'onglet se met à jour tout seul chez tout le monde ----

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_stats'
     ) then
    alter publication supabase_realtime add table public.live_stats;
  end if;
end;
$$;
