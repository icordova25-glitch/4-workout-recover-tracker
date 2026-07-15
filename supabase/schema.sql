create extension if not exists "pgcrypto";

create type public.fitness_goal as enum ('fat_loss', 'maintenance', 'muscle_gain');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'very_active', 'athlete');
create type public.workout_status as enum ('processing', 'complete', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  age integer check (age between 13 and 100),
  sex text check (sex in ('male', 'female', 'other')),
  height_cm numeric(6,2) check (height_cm between 100 and 250),
  weight_kg numeric(6,2) check (weight_kg between 30 and 350),
  goal public.fitness_goal not null default 'fat_loss',
  activity_level public.activity_level not null default 'moderate',
  training_days_per_week integer not null default 4 check (training_days_per_week between 0 and 14),
  target_rate_percent_per_week numeric(4,2) not null default 0.5,
  timezone text not null default 'America/Chicago',
  unit_system text not null default 'imperial' check (unit_system in ('imperial', 'metric')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.workout_status not null default 'processing',
  title text,
  performed_at timestamptz not null default now(),
  image_path text,
  source_text text,
  workout_type text,
  duration_minutes integer,
  intensity text,
  strength_score integer check (strength_score between 0 and 100),
  conditioning_score integer check (conditioning_score between 0 and 100),
  estimated_calories_low integer,
  estimated_calories_high integer,
  muscle_groups text[] not null default '{}',
  extraction jsonb,
  created_at timestamptz not null default now()
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  sets integer,
  reps text,
  load text,
  distance text,
  calories text,
  duration text,
  notes text
);

create table public.daily_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  workout_id uuid references public.workouts(id) on delete set null,
  calories integer not null,
  protein_g integer not null,
  carbs_g integer not null,
  fat_g integer not null,
  water_ml integer,
  sleep_hours numeric(3,1),
  recovery_score integer check (recovery_score between 0 and 100),
  coach_message text,
  calculation jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, target_date)
);

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(6,2),
  body_fat_percent numeric(5,2),
  waist_cm numeric(6,2),
  sleep_hours numeric(3,1),
  soreness integer check (soreness between 1 and 10),
  energy integer check (energy between 1 and 10),
  notes text
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null default now(),
  image_path text,
  description text,
  calories integer,
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  fiber_g integer,
  confidence numeric(4,3),
  analysis jsonb
);

create table public.lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  exercise_name text not null,
  performed_at timestamptz not null default now(),
  weight_kg numeric(7,2),
  reps integer,
  sets integer default 1,
  rpe numeric(3,1),
  estimated_one_rep_max_kg numeric(7,2),
  notes text
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  image_path text not null,
  view text,
  notes text
);

create index workouts_user_date_idx on public.workouts(user_id, performed_at desc);
create index check_ins_user_date_idx on public.check_ins(user_id, measured_at desc);
create index lifts_user_exercise_date_idx on public.lifts(user_id, exercise_name, performed_at desc);

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.daily_targets enable row level security;
alter table public.check_ins enable row level security;
alter table public.meals enable row level security;
alter table public.lifts enable row level security;
alter table public.progress_photos enable row level security;

create policy "profiles own rows" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "workouts own rows" on public.workouts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "workout exercises through owner" on public.workout_exercises
for all using (
  exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  )
);

create policy "daily targets own rows" on public.daily_targets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "checkins own rows" on public.check_ins
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "meals own rows" on public.meals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "lifts own rows" on public.lifts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "progress photos own rows" on public.progress_photos
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('fitness-private', 'fitness-private', false)
on conflict (id) do nothing;

create policy "private fitness uploads"
on storage.objects for all
using (
  bucket_id = 'fitness-private'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'fitness-private'
  and auth.uid()::text = (storage.foldername(name))[1]
);
