-- Dual confirmation + dispute workflow for credit transfer
begin;

-- Add columns to booking_requests to support confirmations and disputes
alter table public.booking_requests
  add column if not exists provider_confirmed boolean not null default false,
  add column if not exists learner_confirmed boolean not null default false,
  add column if not exists provider_confirmed_at timestamptz,
  add column if not exists learner_confirmed_at timestamptz,
  add column if not exists dispute_status text not null default 'none' check (dispute_status in ('none','open','resolved')),
  add column if not exists dispute_reason text,
  add column if not exists dispute_opened_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists admin_resolution text;

-- Process confirmations and transfer credits when both confirm and no dispute
create or replace function public.process_post_meeting_confirmations()
returns trigger
language plpgsql
security definER
set search_path = public
as $$
begin
  -- stamp confirmation times when toggled to true
  if new.provider_confirmed = true and coalesce(old.provider_confirmed, false) = false then
    new.provider_confirmed_at := now();
  end if;
  if new.learner_confirmed = true and coalesce(old.learner_confirmed, false) = false then
    new.learner_confirmed_at := now();
  end if;

  -- if both confirmed, no dispute, and booking is in confirmed state => complete and transfer
  if new.provider_confirmed = true and new.learner_confirmed = true and new.dispute_status = 'none' and new.status = 'confirmed' then
    new.completed_at := now();
    new.status := 'completed';
    new.google_meet_link := null; -- remove meeting link

    -- transfer credits (null-safe)
    update public.profiles set time_credits = coalesce(time_credits,0) - new.credits_amount where user_id = new.learner_id;
    update public.profiles set time_credits = coalesce(time_credits,0) + new.credits_amount where user_id = new.provider_id;

    -- notify both parties
    insert into public.notifications (user_id, booking_request_id, type, title, message)
    values
      (new.learner_id, new.id, 'booking_confirmed', 'Session Completed', 'Credits have been transferred.'),
      (new.provider_id, new.id, 'booking_confirmed', 'Session Completed', 'Credits have been transferred.');
  end if;

  return new;
end;
$$;

-- Trigger on updates to booking_requests
drop trigger if exists process_post_meeting_confirmations_trigger on public.booking_requests;
create trigger process_post_meeting_confirmations_trigger
before update on public.booking_requests
for each row
execute function public.process_post_meeting_confirmations();

commit;
