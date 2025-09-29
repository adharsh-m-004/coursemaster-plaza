-- Enrich notification content with service title and selected slot date/time
-- This migration updates trigger functions to compose richer titles/messages

-- Update: Function to handle booking confirmation and create detailed notifications
CREATE OR REPLACE FUNCTION public.handle_booking_confirmation()
RETURNS TRIGGER AS $$
DECLARE
  svc_title TEXT;
  start_text TEXT;
  end_text TEXT;
BEGIN
  -- Fetch service title and format times
  SELECT title INTO svc_title FROM public.services WHERE id = NEW.service_id;
  start_text := to_char(NEW.requested_start_time, 'YYYY-MM-DD HH24:MI TZ');
  end_text := to_char(NEW.requested_end_time, 'HH24:MI TZ');

  -- When booking is confirmed, mark the availability slot as unavailable
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    UPDATE public.availability_slots 
    SET is_available = false
    WHERE id = NEW.availability_slot_id;
    
    -- Set confirmation timestamp
    NEW.confirmed_at = now();
    
    -- Create notifications for both parties (detailed)
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (
        NEW.learner_id, NEW.id, 'booking_confirmed',
        COALESCE('Booking Confirmed • ' || svc_title, 'Booking Confirmed'),
        COALESCE('Your booking for "' || svc_title || '" on ' || start_text || ' - ' || end_text || ' has been confirmed.',
                 'Your booking has been confirmed.')
      ),
      (
        NEW.provider_id, NEW.id, 'booking_confirmed',
        COALESCE('Booking Confirmed • ' || svc_title, 'Booking Confirmed'),
        COALESCE('You confirmed a booking for "' || svc_title || '" on ' || start_text || ' - ' || end_text || '.',
                 'You confirmed a booking request.')
      );
      
    -- Schedule reminder notifications (1 hour before) with details
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message, scheduled_for)
    VALUES 
      (
        NEW.learner_id, NEW.id, 'booking_reminder',
        COALESCE('Reminder • ' || svc_title, 'Session Reminder'),
        COALESCE('Your session for "' || svc_title || '" starts at ' || start_text || '. Please be ready.','Your session starts soon.'),
        NEW.requested_start_time - INTERVAL '1 hour'
      ),
      (
        NEW.provider_id, NEW.id, 'booking_reminder',
        COALESCE('Reminder • ' || svc_title, 'Session Reminder'),
        COALESCE('Your session for "' || svc_title || '" starts at ' || start_text || '. Please be ready.','Your session starts soon.'),
        NEW.requested_start_time - INTERVAL '1 hour'
      );
      
  -- When booking is declined, make slot available again
  ELSIF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    UPDATE public.availability_slots 
    SET is_available = true
    WHERE id = NEW.availability_slot_id;
    
    SELECT title INTO svc_title FROM public.services WHERE id = NEW.service_id;
    start_text := to_char(NEW.requested_start_time, 'YYYY-MM-DD HH24:MI TZ');
    end_text := to_char(NEW.requested_end_time, 'HH24:MI TZ');

    -- Create notification for learner with details
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (
        NEW.learner_id, NEW.id, 'booking_declined',
        COALESCE('Booking Declined • ' || svc_title, 'Booking Declined'),
        COALESCE('Your booking for "' || svc_title || '" on ' || start_text || ' - ' || end_text || ' was declined.',
                 'Your booking request has been declined by the provider.')
      );
      
  -- When booking is cancelled, make slot available again
  ELSIF NEW.status = 'cancelled' AND OLD.status IN ('confirmed', 'pending') THEN
    UPDATE public.availability_slots 
    SET is_available = true
    WHERE id = NEW.availability_slot_id;
    
    NEW.cancelled_at = now();

    SELECT title INTO svc_title FROM public.services WHERE id = NEW.service_id;
    start_text := to_char(NEW.requested_start_time, 'YYYY-MM-DD HH24:MI TZ');
    end_text := to_char(NEW.requested_end_time, 'HH24:MI TZ');
    
    -- Create notifications for both parties with details
    INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
    VALUES 
      (
        NEW.learner_id, NEW.id, 'booking_cancelled',
        COALESCE('Booking Cancelled • ' || svc_title, 'Booking Cancelled'),
        COALESCE('Your booking for "' || svc_title || '" on ' || start_text || ' - ' || end_text || ' was cancelled.',
                 'The booking has been cancelled.')
      ),
      (
        NEW.provider_id, NEW.id, 'booking_cancelled',
        COALESCE('Booking Cancelled • ' || svc_title, 'Booking Cancelled'),
        COALESCE('The booking for "' || svc_title || '" on ' || start_text || ' - ' || end_text || ' was cancelled.',
                 'The booking has been cancelled.')
      );
      
  -- When booking is completed, process credit transfer
  ELSIF NEW.status = 'completed' AND OLD.status = 'confirmed' THEN
    NEW.completed_at = now();
    
    -- Transfer credits from learner to provider
    UPDATE public.profiles 
    SET time_credits = time_credits - NEW.credits_amount
    WHERE user_id = NEW.learner_id;
    
    UPDATE public.profiles 
    SET time_credits = time_credits + NEW.credits_amount
    WHERE user_id = NEW.provider_id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Update: Function to create notifications for new booking requests with details
CREATE OR REPLACE FUNCTION public.notify_new_booking_request()
RETURNS TRIGGER AS $$
DECLARE
  svc_title TEXT;
  start_text TEXT;
  end_text TEXT;
BEGIN
  SELECT title INTO svc_title FROM public.services WHERE id = NEW.service_id;
  start_text := to_char(NEW.requested_start_time, 'YYYY-MM-DD HH24:MI TZ');
  end_text := to_char(NEW.requested_end_time, 'HH24:MI TZ');

  -- Create notification for provider with details
  INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
  VALUES 
    (
      NEW.provider_id, NEW.id, 'booking_request', 
      COALESCE('New Booking Request • ' || svc_title, 'New Booking Request'),
      COALESCE('New request for "' || svc_title || '" on ' || start_text || ' - ' || end_text || '.',
               'You have received a new booking request for your service.')
    );
     
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
