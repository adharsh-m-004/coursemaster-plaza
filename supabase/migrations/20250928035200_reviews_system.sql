-- Reviews system: table, RLS, policies, and rating aggregation
-- Also adds review tracking fields to booking_requests for optional popup prompts

begin;

-- Ensure UUID generation is available
create extension if not exists pgcrypto;

-- 1) Reviews table
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique, -- at most one review per booking
  service_id uuid not null references public.services(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(user_id) on delete cascade, -- provider being reviewed (user_id)
  reviewer_id uuid not null references public.profiles(user_id) on delete cascade, -- learner writing review (user_id)
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- If the table existed from a previous partial migration, make sure critical columns & constraints exist
alter table public.reviews add column if not exists service_id uuid;
alter table public.reviews add column if not exists booking_id uuid;

do $$
begin
  -- add FK for service_id if missing
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_service_id_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_service_id_fkey
      foreign key (service_id) references public.services(id) on delete cascade;
  end if;

  -- add FK for reviewee_id if missing
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_reviewee_id_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_reviewee_id_fkey
      foreign key (reviewee_id) references public.profiles(user_id) on delete cascade;
  end if;

  -- add FK for reviewer_id if missing
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_reviewer_id_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_reviewer_id_fkey
      foreign key (reviewer_id) references public.profiles(user_id) on delete cascade;
  end if;

  -- add FK for booking_id if missing
  if not exists (
    select 1 from pg_constraint
    where conname = 'reviews_booking_id_fkey'
      and conrelid = 'public.reviews'::regclass
  ) then
    alter table public.reviews
      add constraint reviews_booking_id_fkey
      foreign key (booking_id) references public.booking_requests(id) on delete cascade;
  end if;
end$$;

create index if not exists reviews_reviewee_idx on public.reviews(reviewee_id);
create index if not exists reviews_service_idx on public.reviews(service_id);
create index if not exists reviews_reviewer_idx on public.reviews(reviewer_id);
create unique index if not exists reviews_booking_unique on public.reviews(booking_id);

-- 2) Track review prompt/submission at booking level
alter table public.booking_requests
  add column if not exists review_submitted boolean not null default false,
  add column if not exists review_prompted_at timestamptz;

-- 3) Enable RLS
alter table public.reviews enable row level security;

-- 4) Policies
-- Everyone can read reviews
drop policy if exists reviews_select_any on public.reviews;
create policy reviews_select_any on public.reviews
  for select
  using (true);

-- Only the learner who owns the completed booking can insert a review
drop policy if exists reviews_insert_by_learner on public.reviews;
create policy reviews_insert_by_learner on public.reviews
  for insert
  with check (
    exists (
      select 1 from public.booking_requests b
      where b.id = booking_id
        and b.learner_id = auth.uid()
        and b.status = 'completed'
    )
  );

-- Reviewer can update their own review (optional)
drop policy if exists reviews_update_by_reviewer on public.reviews;
create policy reviews_update_by_reviewer on public.reviews
  for update
  using (reviewer_id = auth.uid())
  with check (reviewer_id = auth.uid());

-- Reviewer can delete their own review (optional)
drop policy if exists reviews_delete_by_reviewer on public.reviews;
create policy reviews_delete_by_reviewer on public.reviews
  for delete
  using (reviewer_id = auth.uid());

-- 5) Maintain updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists trg_reviews_touch on public.reviews;
create trigger trg_reviews_touch
before update on public.reviews
for each row execute function public.touch_updated_at();

-- 6) Aggregate ratings into profiles (rating, total_reviews)
create or replace function public.recompute_profile_rating(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_avg numeric;
  v_cnt int;
begin
  select coalesce(avg(r.rating), 0), count(*)
    into v_avg, v_cnt
  from public.reviews r
  where r.reviewee_id = p_user_id;

  update public.profiles p
    set rating = coalesce(v_avg, 0),
        total_reviews = coalesce(v_cnt, 0)
  where p.user_id = p_user_id;
end;$$;

create or replace function public.on_reviews_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') then
    perform public.recompute_profile_rating(new.reviewee_id);
  elsif (tg_op = 'UPDATE') then
    perform public.recompute_profile_rating(new.reviewee_id);
    if (old.reviewee_id is distinct from new.reviewee_id) then
      perform public.recompute_profile_rating(old.reviewee_id);
    end if;
  elsif (tg_op = 'DELETE') then
    perform public.recompute_profile_rating(old.reviewee_id);
  end if;
  return null;
end;$$;

drop trigger if exists trg_reviews_changed on public.reviews;
create trigger trg_reviews_changed
after insert or update or delete on public.reviews
for each row execute function public.on_reviews_changed();

-- 7) Convenience function: mark booking as reviewed when a review is inserted for it
create or replace function public.on_review_insert_mark_booking()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.booking_id is not null then
    update public.booking_requests
      set review_submitted = true
    where id = new.booking_id;
  end if;
  return new;
end;$$;

drop trigger if exists trg_on_review_insert_mark_booking on public.reviews;
create trigger trg_on_review_insert_mark_booking
after insert on public.reviews
for each row execute function public.on_review_insert_mark_booking();

commit;
