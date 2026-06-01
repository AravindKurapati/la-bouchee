create table if not exists public.meals (
  id text primary key,
  created_at timestamptz not null default now(),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  date date not null,
  meal_type text not null check (meal_type in ('pre-breakfast', 'breakfast', 'lunch', 'dinner')),
  raw_text text not null default '',
  redacted_text text not null default '',
  foods jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  cuisine text not null default 'Mixed',
  source text not null default 'unknown',
  photo_url text not null default '',
  confidence numeric not null default 0,
  privacy_issues jsonb not null default '[]'::jsonb,
  publishable boolean not null default true,
  public_caption text not null default ''
);

create table if not exists public.comments (
  id text primary key,
  meal_id text not null references public.meals(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  text text not null check (length(trim(text)) > 0)
);

create index if not exists meals_date_meal_type_idx on public.meals(date, meal_type);
create index if not exists meals_visibility_idx on public.meals(visibility);
create index if not exists comments_meal_id_created_at_idx on public.comments(meal_id, created_at);

alter table public.meals enable row level security;
alter table public.comments enable row level security;

-- RLS is defense-in-depth only: all app access uses the service-role key, which
-- bypasses RLS. Enforcement of owner-only writes lives in src/auth.mjs.
-- These policies grant public READ of public data and leave writes default-deny
-- for anon/authenticated roles. See SCHEMA.md.

drop policy if exists meals_public_read on public.meals;
create policy meals_public_read on public.meals
  for select
  using (visibility = 'public');

drop policy if exists comments_public_read on public.comments;
create policy comments_public_read on public.comments
  for select
  using (
    exists (
      select 1 from public.meals m
      where m.id = comments.meal_id and m.visibility = 'public'
    )
  );
