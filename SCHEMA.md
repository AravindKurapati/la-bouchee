# SCHEMA

Source of truth: `supabase/schema.sql`. Local fallback mirrors these fields in
`data/meals.json` (camelCase). The server maps snake_case rows ↔ camelCase app
objects in `src/store.mjs`.

## Table: `meals`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `meal_<ts>_<rand>` when generated |
| `created_at` | timestamptz | default `now()` |
| `visibility` | text | `public` \| `private` (check) |
| `date` | date | meal date |
| `meal_type` | text | `pre-breakfast` \| `breakfast` \| `lunch` \| `dinner` (check) |
| `raw_text` | text | original entry (owner-visible) |
| `redacted_text` | text | privacy-redacted text |
| `foods` | jsonb | string[] |
| `tags` | jsonb | string[] |
| `cuisine` | text | default `Mixed` |
| `source` | text | `home`/`takeout`/`restaurant`/`unknown`/`skipped` |
| `photo_url` | text | |
| `confidence` | numeric | 0..1 |
| `privacy_issues` | jsonb | object[] |
| `publishable` | boolean | false when a high-severity privacy signal is found |
| `public_caption` | text | shown on the public board |

Indexes: `(date, meal_type)`, `(visibility)`.

## Table: `comments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | |
| `meal_id` | text FK → meals.id | `on delete cascade` |
| `created_at` | timestamptz | default `now()` |
| `name` | text | not null |
| `text` | text | check `length(trim(text)) > 0` |

Index: `(meal_id, created_at)`.

## Row Level Security
RLS is **enabled** on both tables. All application access uses the **service-role**
key, which bypasses RLS — so policies below are **defense-in-depth + documentation**,
not the primary enforcement (that lives in `src/auth.mjs::requireOwner`).

Policies:
- `meals`: anon/authenticated may **SELECT** rows where `visibility = 'public'`.
- `comments`: anon/authenticated may **SELECT** comments whose parent meal is public.
- **No INSERT/UPDATE/DELETE policies** for anon/authenticated → default deny. Writes
  only ever happen via the service-role key after the owner check.

## Auth (no schema objects)
Owner identity comes from Supabase Auth. The single allowed user is matched by
`OWNER_EMAIL` (env). No custom tables, claims, or roles. See
`documents/FEATURE_owner_auth.md`.
