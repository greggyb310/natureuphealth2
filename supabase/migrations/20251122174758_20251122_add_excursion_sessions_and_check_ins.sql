/*
  # Add Excursion Sessions and Check-ins

  1. New Tables
    - `excursion_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `excursion_id` (uuid, foreign key to excursions)
      - `status` (text, default 'planned')
      - `phase` (text, default 'PLAN')
      - `selected_plan_index` (integer, nullable)
      - `started_at` (timestamptz, nullable)
      - `ended_at` (timestamptz, nullable)
      - `created_at` (timestamptz, default now())
      
    - `excursion_check_ins`
      - `id` (uuid, primary key)
      - `session_id` (uuid, foreign key to excursion_sessions)
      - `zone_id` (text, nullable)
      - `check_in_id` (text, nullable)
      - `type` (text)
      - `value_number` (numeric, nullable)
      - `value_text` (text, nullable)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on both tables
    - Users can only access their own sessions and check-ins
    - Check-ins inherit permissions from their session
*/

create table if not exists excursion_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  excursion_id uuid not null references excursions (id) on delete cascade,
  status text not null default 'planned',
  phase text not null default 'PLAN',
  selected_plan_index integer,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

alter table excursion_sessions enable row level security;

create policy "Users manage own sessions"
  on excursion_sessions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists excursion_check_ins (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references excursion_sessions (id) on delete cascade,
  zone_id text,
  check_in_id text,
  type text not null,
  value_number numeric,
  value_text text,
  created_at timestamptz not null default now()
);

alter table excursion_check_ins enable row level security;

create policy "Users manage own check-ins"
  on excursion_check_ins
  for all
  to authenticated
  using (
    exists (
      select 1 from excursion_sessions s
      where s.id = excursion_check_ins.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from excursion_sessions s
      where s.id = excursion_check_ins.session_id
        and s.user_id = auth.uid()
    )
  );
