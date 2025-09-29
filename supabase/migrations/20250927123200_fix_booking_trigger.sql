-- Fix booking completion trigger: run with elevated privileges and ensure null-safe credit math
-- This addresses an issue where provider credits increment but learner credits are not deducted
-- due to RLS on profiles (only user can update their own row). SECURITY DEFINER runs as owner.

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
    
    -- Set confirmation timestamp
    NEW.confirmed_at = now();
    
    -- Create notifications for both parties
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (NEW.learner_id, NEW.id, 'booking_confirmed', 'Booking Confirmed!', 
       'Your booking request has been confirmed by the provider.'),
      (NEW.provider_id, NEW.id, 'booking_confirmed', 'Booking Confirmed', 
       'You have confirmed a booking request.');
       
    -- Schedule reminder notifications (1 hour before)
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message, scheduled_for)
    VALUES 
      (NEW.learner_id, NEW.id, 'booking_reminder', 'Session Starting Soon', 
       'Your session starts in 1 hour. Check your meeting link.', 
       NEW.requested_start_time - INTERVAL '1 hour'),
      (NEW.provider_id, NEW.id, 'booking_reminder', 'Session Starting Soon', 
       'Your session starts in 1 hour. Check your meeting link.', 
       NEW.requested_start_time - INTERVAL '1 hour');
       
  -- When booking is declined, make slot available again
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    UPDATE public.availability_slots 
    SET is_available = true
    WHERE id = NEW.availability_slot_id;
    
    -- Create notification for learner
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (NEW.learner_id, NEW.id, 'booking_declined', 'Booking Declined', 
       'Your booking request has been declined by the provider.');
       
  -- When booking is cancelled, make slot available again
  ELSIF NEW.status = 'cancelled' AND OLD.status IN ('confirmed', 'pending') THEN
    UPDATE public.availability_slots 
    SET is_available = true
    WHERE id = NEW.availability_slot_id;
    
    NEW.cancelled_at = now();
    
    -- Create notifications for both parties
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (NEW.learner_id, NEW.id, 'booking_cancelled', 'Booking Cancelled', 
       'The booking has been cancelled.'),
      (NEW.provider_id, NEW.id, 'booking_cancelled', 'Booking Cancelled', 
       'The booking has been cancelled.');
       
  -- When booking is completed, process credit transfer
  ELSIF NEW.status = 'completed' AND OLD.status = 'confirmed' THEN
    NEW.completed_at = now();
    
    -- Transfer credits from learner to provider (null-safe and bypassing RLS via SECURITY DEFINER)
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

-- Trigger remains the same, it will call the replaced function with SECURITY DEFINER
-- CREATE TRIGGER handle_booking_confirmation_trigger ... unchanged
