# Cairn / Radix v3 — Deployment Guide (Vercel + Supabase)

This guide documents deploying Cairn v3 to **Vercel** with **Supabase** as the single source of truth for all reference data, storage, cache, rate limits, and passwordless authentication.

---

## 1. Architecture: Supabase as Single Source of Truth

In Radix v3, the serverless deployment contains **zero local reference data files**:
- **Reference Data (PostgREST)**:
  - `skill_sets`: 12 canonical skill sets.
  - `company_json`: 118 enterprise benchmark company profiles with company metadata.
  - `company_skill_levels`: 1356 skill level requirements across benchmark companies.
  - `app_content`: `roadmap_kb` with comprehensive skill mastery bands, projects, and certifications.
  - `samples`: Metadata for all sample resumes and JDs.
- **Storage**:
  - `samples` bucket (public): Serves sample resumes and JDs directly via CDN.
  - `resumes` bucket (private): Secure storage for user uploaded resumes with signed URLs.
- **Application Caching & Rate Limiting**:
  - `extraction_cache`: Persistent LLM extraction cache.
  - `api_cache`: Transient response cache.
  - `rate_limits` + `hit_rate_limit`: Atomic serverless rate limiter.
- **Unified Remote Data Layer (`app/data_source.py`)**:
  - In-process memory cache with 1-hour TTL (3600s).
  - 3-second timeout per call with automatic 1-retry.
  - Read-only snapshot fallback (`data/snapshot/`) enabled when `ALLOW_SNAPSHOT_FALLBACK=1` (default 1 local, 0 on Vercel).
  - `/health` endpoint exposes `{"data_source": "supabase"|"snapshot", "companies": N, "levels": N, "skill_sets": 12, ...}`.

---

## 2. Supabase SQL Setup

Run the following SQL scripts in your Supabase project under **SQL Editor**:

### Step 2.1: Cache & Rate Limiting Tables
```sql
create table if not exists extraction_cache (
  cache_key text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists api_cache (
  cache_key text primary key,
  data jsonb not null,
  expires_at timestamptz not null
);

create table if not exists rate_limits (
  bucket text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

alter table extraction_cache enable row level security;
alter table api_cache enable row level security;
alter table rate_limits enable row level security;

create or replace function hit_rate_limit(p_bucket text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
as $$
declare c int;
begin
  insert into rate_limits(bucket, count, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update set
    count = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                 then 1 else rate_limits.count + 1 end,
    window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                        then now() else rate_limits.window_start end
  returning count into c;
  return c <= p_max;
end $$;

revoke execute on function hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function hit_rate_limit(text, int, int) to service_role;
```

### Step 2.2: User Data & Application Tracking Tables
```sql
create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_name text not null,
  file_path text not null,
  file_size int,
  is_primary boolean not null default false,
  extracted jsonb,
  socials jsonb,
  created_at timestamptz not null default now()
);

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  jd_title text, jd_company text, jd jsonb,
  result jsonb not null,
  match_score int, readiness_score int, ats_score int,
  roadmap_done jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null, role text not null,
  status text not null default 'saved'
    check (status in ('saved','applied','interview','offer','rejected')),
  resume_id uuid references resumes(id) on delete set null,
  analysis_id uuid references analyses(id) on delete set null,
  job_url text, notes text, applied_on date,
  created_at timestamptz not null default now()
);

create index if not exists resumes_user_idx on resumes(user_id, created_at desc);
create index if not exists analyses_user_idx on analyses(user_id, created_at desc);
create index if not exists applications_user_idx on applications(user_id, created_at desc);

alter table resumes enable row level security;
alter table analyses enable row level security;
alter table applications enable row level security;

create policy "Users manage own resumes" on resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own analyses" on analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own applications" on applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

---

## 3. Database Seeding & Verification

### Dry-Run Seeding:
```powershell
python scripts/seed_supabase.py --dry-run
```

### Live Seeding:
```powershell
python scripts/seed_supabase.py
```
Outputs:
- `skill_sets 12`
- `company_json 118`
- `company_skill_levels 1356`
- `app_content: roadmap_kb`
- `samples 10` (and uploads 10 sample PDFs to the public `samples` bucket)
- Level matches verified for Google (4), Microsoft (78), Oracle FSS (24).

### Remote Row-by-Row Verification:
```powershell
python scripts/verify_remote.py
```

### Pure Supabase In-Memory Verification (Simulating Zero Local Files):
```powershell
python scripts/verify_isolated_supabase.py
```

---

## 4. Environment Variables on Vercel

Configure these in the Vercel Project Settings under **Environment Variables**:

| Variable Name | Environment | Description |
|---|---|---|
| `GEMINI_API_KEY` | Production, Preview | Primary LLM API key |
| `LLM_PROVIDER` | Production, Preview | `gemini` |
| `RADIX_MODEL` | Production, Preview | `gemini-3.5-flash-lite` |
| `SUPABASE_URL` | Production, Preview | Project URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | Production, Preview | Supabase Publishable / Anon key |
| `SUPABASE_SERVICE_KEY` | Production, Preview (Server-only) | Supabase `service_role` JWT |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Supabase URL for client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview | Supabase Publishable key for client |
| `ALLOW_SNAPSHOT_FALLBACK` | Production (optional) | Set to `0` (enforces strict remote-only execution) |

---

## 5. Slimming & Vercel Configuration

In `vercel.json`:
- `"includeFiles": "data/**"` is **removed**.
- Seed files (`company_json_rows__1_.csv`, `company_skill_levels_rows.csv`, `roadmap_kb.json`, `jds/`, `resumes/`, `cache/`) are located in `seed/` and excluded via `.vercelignore`.
- Serverless bundle size is reduced by >90%.
