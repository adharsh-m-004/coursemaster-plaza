-- Immediate credit transfer on booking registration
begin;

-- Track whether credits have already been transferred for this booking
alter table public.booking_requests
  add column if not exists credits_transferred boolean not null default false;

-- RPC to create booking and transfer credits atomically
create or replace function public.create_booking_with_payment(
  p_availability_slot_id uuid,
  p_service_id uuid,
  p_provider_id uuid,
  p_learner_id uuid,
  p_requested_start_time timestamptz,
  p_requested_end_time timestamptz,
  p_credits_amount integer,
  p_learner_notes text
)
returns public.booking_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_learner_credits integer;
  v_booking public.booking_requests;
begin
  -- Optional auth check: ensure caller is the learner
  if auth.uid() is not null and auth.uid() <> p_learner_id then
    raise exception 'Unauthorized: caller is not the learner';
  end if;

  -- Ensure valid amounts
  if p_credits_amount <= 0 then
    raise exception 'Invalid credits amount';
  end if;

  -- Lock learner row and verify balance
  select coalesce(time_credits, 0) into v_learner_credits
  from public.profiles
  where user_id = p_learner_id
  for update;

  if v_learner_credits is null then
    raise exception 'Learner profile not found';
  end if;

  if v_learner_credits < p_credits_amount then
    raise exception 'INSUFFICIENT_CREDITS: You need % credits but only have %', p_credits_amount, v_learner_credits;
  end if;

  -- Transfer credits now (null-safe)
  update public.profiles
    set time_credits = coalesce(time_credits, 0) - p_credits_amount
  where user_id = p_learner_id;

  update public.profiles
    set time_credits = coalesce(time_credits, 0) + p_credits_amount
  where user_id = p_provider_id;

  -- Create booking request (pending) and mark as transferred
  insert into public.booking_requests (
    availability_slot_id,
    service_id,
    provider_id,
    learner_id,
    requested_start_time,
    requested_end_time,
    status,
    credits_amount,
    learner_notes,
    credits_transferred
  ) values (
    p_availability_slot_id,
    p_service_id,
    p_provider_id,
    p_learner_id,
    p_requested_start_time,
    p_requested_end_time,
    'pending',
    p_credits_amount,
    p_learner_notes,
    true
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

-- Ensure downstream completion handlers do NOT re-transfer if already paid at booking
create or replace function public.handle_booking_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- When booking is confirmed, mark the availability slot as unavailable
  if new.status = 'confirmed' and old.status = 'pending' then
    update public.availability_slots 
      set is_available = false
      where id = new.availability_slot_id;

    new.confirmed_at = now();

    insert into public.notifications (user_id, booking_request_id, type, title, message)
    values 
      (new.learner_id, new.id, 'booking_confirmed', 'Booking Confirmed!', 'Your booking request has been confirmed by the provider.'),
      (new.provider_id, new.id, 'booking_confirmed', 'Booking Confirmed', 'You have confirmed a booking request.');

    insert into public.notifications (user_id, booking_request_id, type, title, message, scheduled_for)
    values 
      (new.learner_id, new.id, 'booking_reminder', 'Session Starting Soon', 'Your session starts in 1 hour. Check your meeting link.', new.requested_start_time - interval '1 hour'),
      (new.provider_id, new.id, 'booking_reminder', 'Session Starting Soon', 'Your session starts in 1 hour. Check your meeting link.', new.requested_start_time - interval '1 hour');

  -- When booking is declined, make slot available again
  elsif new.status = 'declined' and old.status = 'pending' then
    update public.availability_slots 
      set is_available = true
      where id = new.availability_slot_id;

    insert into public.notifications (user_id, booking_request_id, type, title, message)
    values 
      (new.learner_id, new.id, 'booking_declined', 'Booking Declined', 'Your booking request has been declined by the provider.');

  -- When booking is cancelled, make slot available again
  elsif new.status = 'cancelled' and old.status in ('confirmed', 'pending') then
    update public.availability_slots 
      set is_available = true
      where id = new.availability_slot_id;

    new.cancelled_at = now();

    insert into public.notifications (user_id, booking_request_id, type, title, message)
    values 
      (new.learner_id, new.id, 'booking_cancelled', 'Booking Cancelled', 'The booking has been cancelled.'),
      (new.provider_id, new.id, 'booking_cancelled', 'Booking Cancelled', 'The booking has been cancelled.');

  -- When booking is completed, process credit transfer ONLY if not already transferred
  elsif new.status = 'completed' and old.status = 'confirmed' then
    new.completed_at = now();

    if coalesce(new.credits_transferred, false) = false then
      update public.profiles set time_credits = coalesce(time_credits, 0) - new.credits_amount where user_id = new.learner_id;
      update public.profiles set time_credits = coalesce(time_credits, 0) + new.credits_amount where user_id = new.provider_id;
      new.credits_transferred := true;
    end if;
  end if;

  return new;
end;
$$;

-- Dual confirmation function: also guard against double transfer
create or replace function public.process_post_meeting_confirmations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.provider_confirmed = true and coalesce(old.provider_confirmed, false) = false then
    new.provider_confirmed_at := now();
  end if;
  if new.learner_confirmed = true and coalesce(old.learner_confirmed, false) = false then
    new.learner_confirmed_at := now();
  end if;

  if new.provider_confirmed = true and new.learner_confirmed = true and new.dispute_status = 'none' and new.status = 'confirmed' then
    new.completed_at := now();
    new.status := 'completed';
    new.google_meet_link := null;

    if coalesce(new.credits_transferred, false) = false then
      update public.profiles set time_credits = coalesce(time_credits,0) - new.credits_amount where user_id = new.learner_id;
      update public.profiles set time_credits = coalesce(time_credits,0) + new.credits_amount where user_id = new.provider_id;
      new.credits_transferred := true;
    end if;

    insert into public.notifications (user_id, booking_request_id, type, title, message)
    values
      (new.learner_id, new.id, 'booking_confirmed', 'Session Completed', 'Credits have been transferred.'),
      (new.provider_id, new.id, 'booking_confirmed', 'Session Completed', 'Credits have been transferred.');
  end if;

  return new;
end;
$$;

commit;
