-- ============================================================
-- WEMOVED — Schéma Supabase complet
-- Coller dans : Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. PROFILES
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  pseudo      text unique not null,
  email       text,
  initials    text generated always as (upper(left(pseudo,2))) stored,
  role        text not null default 'membre'
                check (role in ('admin','manager','moderateur','animateur','membre')),
  bio         text default '',
  interests   text[] default '{}',
  region      text default '',
  dept        text default '',
  city        text default '',
  age         int,
  friends     int default 0,
  posts       int default 0,
  joined      text,
  online      boolean default false,
  banned      boolean default false,
  votes       jsonb default '{"mimi":0,"cool":0,"sexy":0,"loose":0}',
  created_at  timestamptz default now()
);

-- 2. THREADS (discussions forum)
create table if not exists public.threads (
  id          bigint generated always as identity primary key,
  author_id   uuid references public.profiles(id) on delete set null,
  cat         text not null default 'Divers',
  title       text not null,
  body        text not null,
  likes       int default 0,
  pinned      boolean default false,
  locked      boolean default false,
  hidden      boolean default false,
  created_at  timestamptz default now()
);

-- 3. REPLIES (réponses aux threads)
create table if not exists public.replies (
  id          bigint generated always as identity primary key,
  thread_id   bigint references public.threads(id) on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  body        text not null,
  hidden      boolean default false,
  created_at  timestamptz default now()
);

-- 4. LIKES (likes sur les threads)
create table if not exists public.thread_likes (
  thread_id   bigint references public.threads(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  primary key (thread_id, user_id)
);

-- 5. VOTES (votes mensuels)
create table if not exists public.votes (
  id          bigint generated always as identity primary key,
  from_id     uuid references public.profiles(id) on delete cascade,
  to_id       uuid references public.profiles(id) on delete cascade,
  vote_type   text not null check (vote_type in ('mimi','cool','sexy','loose')),
  month_key   text not null,
  unique (from_id, to_id, vote_type, month_key)
);

-- 6. MESSAGES PRIVÉS
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  from_id     uuid references public.profiles(id) on delete cascade,
  to_id       uuid references public.profiles(id) on delete cascade,
  body        text not null,
  read        boolean default false,
  created_at  timestamptz default now()
);

-- 7. FRIENDSHIPS
create table if not exists public.friendships (
  id          bigint generated always as identity primary key,
  user_a      uuid references public.profiles(id) on delete cascade,
  user_b      uuid references public.profiles(id) on delete cascade,
  status      text default 'pending' check (status in ('pending','accepted')),
  created_at  timestamptz default now(),
  unique (user_a, user_b)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles    enable row level security;
alter table public.threads     enable row level security;
alter table public.replies     enable row level security;
alter table public.thread_likes enable row level security;
alter table public.votes       enable row level security;
alter table public.messages    enable row level security;
alter table public.friendships enable row level security;

-- PROFILES : lecture publique, écriture sur son propre profil
create policy "Profiles visibles par tous"
  on public.profiles for select using (true);

create policy "Modifier son propre profil"
  on public.profiles for update using (auth.uid() = id);

create policy "Insérer son profil à l'inscription"
  on public.profiles for insert with check (auth.uid() = id);

-- THREADS : lecture publique (sauf hidden), création connecté
create policy "Threads visibles"
  on public.threads for select using (hidden = false or auth.uid() is not null);

create policy "Créer un thread"
  on public.threads for insert with check (auth.uid() is not null);

create policy "Modifier son thread"
  on public.threads for update using (author_id = auth.uid());

-- REPLIES : lecture publique, création connecté
create policy "Replies visibles"
  on public.replies for select using (hidden = false or auth.uid() is not null);

create policy "Créer une réponse"
  on public.replies for insert with check (auth.uid() is not null);

-- THREAD LIKES
create policy "Voir les likes"
  on public.thread_likes for select using (true);

create policy "Liker un thread"
  on public.thread_likes for insert with check (auth.uid() = user_id);

create policy "Unliker"
  on public.thread_likes for delete using (auth.uid() = user_id);

-- VOTES
create policy "Voir les votes"
  on public.votes for select using (true);

create policy "Voter"
  on public.votes for insert with check (auth.uid() = from_id);

create policy "Dévote"
  on public.votes for delete using (auth.uid() = from_id);

-- MESSAGES
create policy "Voir ses messages"
  on public.messages for select using (auth.uid() = from_id or auth.uid() = to_id);

create policy "Envoyer un message"
  on public.messages for insert with check (auth.uid() = from_id);

-- FRIENDSHIPS
create policy "Voir amitiés"
  on public.friendships for select using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Demande d'amitié"
  on public.friendships for insert with check (auth.uid() = user_a);

create policy "Accepter une amitié"
  on public.friendships for update using (auth.uid() = user_b);
