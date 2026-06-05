-- Run this in Supabase SQL Editor (Dashboard -> SQL -> New query)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  player_name text not null,
  score integer not null check (score >= 0),
  time_seconds integer not null default 0 check (time_seconds >= 0),
  pearls_collected integer not null default 0 check (pearls_collected >= 0),
  won boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists scores_leaderboard_idx
  on public.scores (won desc, score desc, time_seconds asc);

create index if not exists scores_user_id_idx
  on public.scores (user_id, created_at desc);

alter table public.scores enable row level security;

create policy "Leaderboard is public"
  on public.scores for select using (true);

create policy "Users can insert own scores"
  on public.scores for insert with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();