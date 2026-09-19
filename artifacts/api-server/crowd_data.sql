create table if not exists public.crowd_data (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  camera_id text not null,
  zone text not null default 'Unknown zone',
  stream_url text not null,
  head_count integer not null check (head_count >= 0),
  average_crowd numeric not null check (average_crowd >= 0),
  peak_crowd integer not null check (peak_crowd >= 0),
  measurements integer not null check (measurements > 0),
  historical_3d_average numeric,
  crowd_level text not null check (crowd_level in ('Low', 'Normal', 'High', 'Unavailable')),
  captured_at timestamptz not null default now(),
  source text not null default 'yolo',
  model_name text not null
);

create index if not exists crowd_data_camera_time_idx
  on public.crowd_data (camera_id, captured_at desc);

alter table public.crowd_data enable row level security;

create policy "Users can read their own crowd observations"
  on public.crowd_data for select
  using (auth.uid() = owner_user_id);

create policy "Users can insert their own crowd observations"
  on public.crowd_data for insert
  with check (auth.uid() = owner_user_id);