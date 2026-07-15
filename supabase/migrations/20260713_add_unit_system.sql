alter table public.profiles
add column if not exists unit_system text not null default 'imperial';

alter table public.profiles
drop constraint if exists profiles_unit_system_check;

alter table public.profiles
add constraint profiles_unit_system_check
check (unit_system in ('imperial', 'metric'));
