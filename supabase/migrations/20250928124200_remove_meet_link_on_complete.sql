-- Nullify meeting link at completion time in DB trigger
-- Ensures google_meet_link is removed when a booking is marked completed

CREATE OR REPLACE FUNCTION public.handle_booking_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When booking is confirmed, mark the availability slot as unavailable
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    UPDATE public.availability_slots 
    SET is_available = false
    WHERE id = NEW.availability_slot_id;
    
    NEW.confirmed_at = now();
    
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (NEW.learner_id, NEW.id, 'booking_confirmed', 'Booking Confirmed!', 'Your booking request has been confirmed by the provider.'),
      (NEW.provider_id, NEW.id, 'booking_confirmed', 'Booking Confirmed', 'You have confirmed a booking request.');
       
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message, scheduled_for)
    VALUES 
      (NEW.learner_id, NEW.id, 'booking_reminder', 'Session Starting Soon', 'Your session starts in 1 hour. Check your meeting link.', NEW.requested_start_time - INTERVAL '1 hour'),
      (NEW.provider_id, NEW.id, 'booking_reminder', 'Session Starting Soon', 'Your session starts in 1 hour. Check your meeting link.', NEW.requested_start_time - INTERVAL '1 hour');
  
  -- When booking is declined, make slot available again
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    UPDATE public.availability_slots 
    SET is_available = true
    WHERE id = NEW.availability_slot_id;
    
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES (NEW.learner_id, NEW.id, 'booking_declined', 'Booking Declined', 'Your booking request has been declined by the provider.');

  -- When booking is cancelled, make slot available again
  ELSIF NEW.status = 'cancelled' AND OLD.status IN ('confirmed', 'pending') THEN
    UPDATE public.availability_slots 
    SET is_available = true
    WHERE id = NEW.availability_slot_id;
    
    NEW.cancelled_at = now();
    
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (NEW.learner_id, NEW.id, 'booking_cancelled', 'Booking Cancelled', 'The booking has been cancelled.'),
      (NEW.provider_id, NEW.id, 'booking_cancelled', 'Booking Cancelled', 'The booking has been cancelled.');

  -- When booking is completed, process credit transfer and remove meeting link
  ELSIF NEW.status = 'completed' AND OLD.status = 'confirmed' THEN
    NEW.completed_at = now();

    -- Nullify the meeting link at completion
    NEW.google_meet_link = NULL;

    -- Transfer credits from learner to provider (null-safe)
    UPDATE public.profiles 
    SET time_credits = COALESCE(time_credits, 0) - NEW.credits_amount
    WHERE user_id = NEW.learner_id;
    
    UPDATE public.profiles 
    SET time_credits = COALESCE(time_credits, 0) + NEW.credits_amount
    WHERE user_id = NEW.provider_id;
  END IF;
  
  RETURN NEW;
END;
$$;
