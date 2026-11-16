-- Classement en ligne du Clicker du QG.
--
-- Profil : un pseudo + un code secret à 4 chiffres (pas de courriel, pas de mot de passe).
-- Score  : l'argent total gagné (totalEarned) de la meilleure partie, avec son palier.
--
-- Sécurité :
--   - Le code n'est jamais stocké en clair (bcrypt via pgcrypto).
--   - La table des joueurs (codes) est illisible depuis le navigateur.
--   - Le classement (table scores) est lisible par tous, mais on n'y écrit QUE par les
--     fonctions join_leaderboard et submit_score, qui vérifient le code.
--   - 5 mauvais codes de suite bloquent le pseudo 15 minutes (un code à 4 chiffres se devine vite sinon).
--   - Un envoi de score au plus toutes les 10 secondes par joueur.
-- Limite connue : la partie est calculée dans le navigateur, donc un joueur motivé peut
-- envoyer un faux score. Entre amis, c'est accepté (voir ROADMAP.md).
--
-- À exécuter une fois dans Supabase : SQL Editor → coller ce fichier → Run.
-- Le fichier peut être relancé sans danger.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---- Joueurs (privé) ------------------------------------------------------

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null,
  pseudo_key text generated always as (lower(pseudo)) stored,
  code_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_submit_at timestamptz,
  created_at timestamptz not null default now(),
  constraint players_pseudo_key_unique unique (pseudo_key)
);

alter table public.players enable row level security;
revoke all on public.players from anon, authenticated;

-- ---- Classement (public en lecture) ---------------------------------------

create table if not exists public.scores (
  player_id uuid primary key references public.players (id) on delete cascade,
  pseudo text not null,
  character_id text not null,
  total_earned double precision not null default 0 check (total_earned >= 0),
  tier_index smallint not null default 0 check (tier_index between 0 and 99),
  fans double precision not null default 0 check (fans >= 0),
  territories smallint not null default 0 check (territories between 0 and 999),
  updated_at timestamptz not null default now()
);

create index if not exists scores_total_earned_idx on public.scores (total_earned desc);

alter table public.scores enable row level security;
drop policy if exists "classement lisible par tous" on public.scores;
create policy "classement lisible par tous" on public.scores for select to anon, authenticated using (true);
revoke all on public.scores from anon, authenticated;
grant select on public.scores to anon, authenticated;

-- ---- Vérification du code (interne) ---------------------------------------

create or replace function public._check_player_code(p_player_id uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players;
begin
  select * into v_player from public.players where id = p_player_id for update;
  if v_player.locked_until is not null and v_player.locked_until > now() then
    return json_build_object('status', 'locked', 'retry_at', v_player.locked_until);
  end if;
  if v_player.code_hash = extensions.crypt(p_code, v_player.code_hash) then
    update public.players set failed_attempts = 0, locked_until = null where id = p_player_id;
    return json_build_object('status', 'ok');
  end if;
  update public.players
     set failed_attempts = case when v_player.failed_attempts + 1 >= 5 then 0 else v_player.failed_attempts + 1 end,
         locked_until = case when v_player.failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
   where id = p_player_id;
  if v_player.failed_attempts + 1 >= 5 then
    return json_build_object('status', 'locked', 'retry_at', now() + interval '15 minutes');
  end if;
  return json_build_object('status', 'wrong_code', 'attempts_left', 5 - (v_player.failed_attempts + 1));
end;
$$;

revoke all on function public._check_player_code(uuid, text) from public, anon, authenticated;

-- ---- Rejoindre le classement : crée le pseudo, ou s'y reconnecte avec le code ----
-- Réponse : { status: 'created' | 'ok' | 'wrong_code' | 'locked' | 'invalid_pseudo' | 'invalid_code', pseudo, best }
-- Les erreurs sont renvoyées comme statut (pas comme exception) pour que le compteur
-- de mauvais codes soit bien enregistré.

create or replace function public.join_leaderboard(p_pseudo text, p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pseudo text := btrim(coalesce(p_pseudo, ''));
  v_player public.players;
  v_check json;
  v_best public.scores;
begin
  if v_pseudo !~ '^[A-Za-z0-9À-ÖØ-öø-ÿ _.-]{2,16}$' then
    return json_build_object('status', 'invalid_pseudo');
  end if;
  if coalesce(p_code, '') !~ '^[0-9]{4}$' then
    return json_build_object('status', 'invalid_code');
  end if;

  select * into v_player from public.players where pseudo_key = lower(v_pseudo);
  if not found then
    begin
      insert into public.players (pseudo, code_hash)
      values (v_pseudo, extensions.crypt(p_code, extensions.gen_salt('bf', 8)))
      returning * into v_player;
    exception when unique_violation then
      -- Quelqu'un vient de prendre ce pseudo à la même seconde : on vérifie le code.
      select * into v_player from public.players where pseudo_key = lower(v_pseudo);
      v_check := public._check_player_code(v_player.id, p_code);
      if v_check->>'status' <> 'ok' then return v_check; end if;
      return json_build_object('status', 'ok', 'pseudo', v_player.pseudo);
    end;
    return json_build_object('status', 'created', 'pseudo', v_player.pseudo);
  end if;

  v_check := public._check_player_code(v_player.id, p_code);
  if v_check->>'status' <> 'ok' then return v_check; end if;
  select * into v_best from public.scores where player_id = v_player.id;
  return json_build_object(
    'status', 'ok',
    'pseudo', v_player.pseudo,
    'best', case when v_best.player_id is null then null else v_best.total_earned end
  );
end;
$$;

-- ---- Envoyer un score -------------------------------------------------------
-- Garde la meilleure partie : le score n'est remplacé que s'il est au moins aussi haut.
-- Réponse : { status: 'ok' | 'kept' | 'too_soon' | 'wrong_code' | 'locked' | 'unknown_player' | 'invalid_score', rank }

create or replace function public.submit_score(
  p_pseudo text,
  p_code text,
  p_character text,
  p_total_earned double precision,
  p_tier_index integer,
  p_fans double precision default 0,
  p_territories integer default 0
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players;
  v_check json;
  v_current double precision;
  v_status text := 'ok';
  v_rank integer;
begin
  select * into v_player from public.players where pseudo_key = lower(btrim(coalesce(p_pseudo, '')));
  if not found then
    return json_build_object('status', 'unknown_player');
  end if;

  v_check := public._check_player_code(v_player.id, coalesce(p_code, ''));
  if v_check->>'status' <> 'ok' then return v_check; end if;

  if v_player.last_submit_at is not null and v_player.last_submit_at > now() - interval '10 seconds' then
    return json_build_object('status', 'too_soon');
  end if;

  if p_total_earned is null or p_total_earned < 0 or p_total_earned > 1e300 or p_total_earned = 'NaN'::double precision
     or p_tier_index is null or p_tier_index not between 0 and 99
     or coalesce(p_fans, 0) < 0 or coalesce(p_fans, 0) > 1e300 or p_fans = 'NaN'::double precision
     or coalesce(p_territories, 0) not between 0 and 999
     or coalesce(p_character, '') !~ '^[a-z0-9-]{1,32}$' then
    return json_build_object('status', 'invalid_score');
  end if;

  update public.players set last_submit_at = now() where id = v_player.id;

  select total_earned into v_current from public.scores where player_id = v_player.id;
  if v_current is null then
    insert into public.scores (player_id, pseudo, character_id, total_earned, tier_index, fans, territories)
    values (v_player.id, v_player.pseudo, p_character, p_total_earned, p_tier_index, coalesce(p_fans, 0), coalesce(p_territories, 0));
  elsif p_total_earned >= v_current then
    update public.scores
       set pseudo = v_player.pseudo, character_id = p_character, total_earned = p_total_earned,
           tier_index = p_tier_index, fans = coalesce(p_fans, 0), territories = coalesce(p_territories, 0),
           updated_at = now()
     where player_id = v_player.id;
  else
    v_status := 'kept'; -- partie moins avancée que le record : on garde le record
  end if;

  select 1 + count(*) into v_rank
    from public.scores
   where total_earned > (select total_earned from public.scores where player_id = v_player.id);
  return json_build_object('status', v_status, 'rank', v_rank);
end;
$$;

revoke all on function public.join_leaderboard(text, text) from public;
revoke all on function public.submit_score(text, text, text, double precision, integer, double precision, integer) from public;
grant execute on function public.join_leaderboard(text, text) to anon, authenticated;
grant execute on function public.submit_score(text, text, text, double precision, integer, double precision, integer) to anon, authenticated;

-- ---- Temps réel : le classement se met à jour tout seul chez tout le monde ----

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scores'
     ) then
    alter publication supabase_realtime add table public.scores;
  end if;
end;
$$;
