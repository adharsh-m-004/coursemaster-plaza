-- Create availability_slots table for teacher availability
CREATE TABLE public.availability_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  is_recurring BOOLEAN DEFAULT false,
  recurring_pattern TEXT, -- 'weekly', 'daily', etc.
  recurring_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Create booking_requests table for learner booking requests
CREATE TABLE public.booking_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  availability_slot_id UUID NOT NULL REFERENCES public.availability_slots(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  requested_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  requested_end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'completed')),
  credits_amount INTEGER NOT NULL,
  google_meet_link TEXT,
  provider_notes TEXT,
  learner_notes TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_time_range CHECK (requested_end_time > requested_start_time)
);

-- Create notifications table for reminders and updates
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  booking_request_id UUID REFERENCES public.booking_requests(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('booking_request', 'booking_confirmed', 'booking_declined', 'booking_reminder', 'booking_cancelled', 'session_starting')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for availability_slots
CREATE POLICY "Availability slots are viewable by everyone" 
ON public.availability_slots 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own availability slots" 
ON public.availability_slots 
FOR ALL 
USING (auth.uid() = provider_id);

-- RLS Policies for booking_requests
CREATE POLICY "Users can view booking requests they're involved in" 
ON public.booking_requests 
FOR SELECT 
USING (auth.uid() = provider_id OR auth.uid() = learner_id);

CREATE POLICY "Learners can create booking requests" 
ON public.booking_requests 
FOR INSERT 
WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "Users can update booking requests they're involved in" 
ON public.booking_requests 
FOR UPDATE 
USING (auth.uid() = provider_id OR auth.uid() = learner_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_availability_slots_updated_at
BEFORE UPDATE ON public.availability_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_booking_requests_updated_at
BEFORE UPDATE ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle booking confirmation and Google Meet link generation
CREATE OR REPLACE FUNCTION public.handle_booking_confirmation()
RETURNS TRIGGER AS $$
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
       'Your session starts in 1 hour. Check your Google Meet link.', 
       NEW.requested_start_time - INTERVAL '1 hour'),
      (NEW.provider_id, NEW.id, 'booking_reminder', 'Session Starting Soon', 
       'Your session starts in 1 hour. Check your Google Meet link.', 
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

-- Create trigger for booking confirmation handling
CREATE TRIGGER handle_booking_confirmation_trigger
BEFORE UPDATE ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_booking_confirmation();

-- Function to create notifications for new booking requests
CREATE OR REPLACE FUNCTION public.notify_new_booking_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for provider
  INSERT INTO public.notifications (user_id, booking_request_id, type, title, message)
  VALUES 
    (NEW.provider_id, NEW.id, 'booking_request', 'New Booking Request', 
     'You have received a new booking request for your service.');
     
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for new booking request notifications
CREATE TRIGGER notify_new_booking_request_trigger
AFTER INSERT ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_booking_request();

-- Function to generate Google Meet links (placeholder - would integrate with Google Calendar API)
CREATE OR REPLACE FUNCTION public.generate_google_meet_link(booking_id UUID)
RETURNS TEXT AS $$
BEGIN
  -- This is a placeholder function
  -- In a real implementation, this would integrate with Google Calendar API
  -- For now, return a placeholder link
  RETURN 'https://meet.google.com/placeholder-' || SUBSTRING(booking_id::TEXT FROM 1 FOR 8);
END;
$$ LANGUAGE plpgsql;

-- Add indexes for better performance
CREATE INDEX idx_availability_slots_provider_service ON public.availability_slots(provider_id, service_id);
CREATE INDEX idx_availability_slots_time_range ON public.availability_slots(start_time, end_time);
CREATE INDEX idx_booking_requests_provider ON public.booking_requests(provider_id);
CREATE INDEX idx_booking_requests_learner ON public.booking_requests(learner_id);
CREATE INDEX idx_booking_requests_status ON public.booking_requests(status);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX idx_notifications_scheduled ON public.notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
