-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  bio TEXT,
  skills TEXT[],
  time_credits INTEGER DEFAULT 10, -- Starting credits
  rating DECIMAL(2,1) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create services table for skill offerings
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  duration_hours INTEGER NOT NULL DEFAULT 1,
  credits_per_hour INTEGER NOT NULL DEFAULT 1,
  location TEXT,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table for service exchanges
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  credits_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  scheduled_date TIMESTAMP WITH TIME ZONE,
  completion_date TIMESTAMP WITH TIME ZONE,
  provider_confirmed BOOLEAN DEFAULT false,
  receiver_confirmed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reviews table for rating system
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table for user communication
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for services
CREATE POLICY "Services are viewable by everyone" 
ON public.services 
FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own services" 
ON public.services 
FOR ALL 
USING (auth.uid() = provider_id);

-- RLS Policies for transactions
CREATE POLICY "Users can view transactions they're involved in" 
ON public.transactions 
FOR SELECT 
USING (auth.uid() = provider_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create transactions as receiver" 
ON public.transactions 
FOR INSERT 
WITH CHECK (auth.uid() = receiver_id);

CREATE POLICY "Users can update transactions they're involved in" 
ON public.transactions 
FOR UPDATE 
USING (auth.uid() = provider_id OR auth.uid() = receiver_id);

-- RLS Policies for reviews
CREATE POLICY "Reviews are viewable by everyone" 
ON public.reviews 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create reviews for their transactions" 
ON public.reviews 
FOR INSERT 
WITH CHECK (auth.uid() = reviewer_id);

-- RLS Policies for messages
CREATE POLICY "Users can view their own messages" 
ON public.messages 
FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their received messages" 
ON public.messages 
FOR UPDATE 
USING (auth.uid() = receiver_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to update user rating after review
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the reviewee's rating and review count
  UPDATE public.profiles 
  SET 
    rating = (
      SELECT COALESCE(AVG(rating::decimal), 0)
      FROM public.reviews 
      WHERE reviewee_id = NEW.reviewee_id
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews 
      WHERE reviewee_id = NEW.reviewee_id
    )
  WHERE user_id = NEW.reviewee_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to update rating when review is added
CREATE TRIGGER update_rating_on_review
AFTER INSERT ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_user_rating();

-- Function to handle credit transfer when transaction completes
CREATE OR REPLACE FUNCTION public.process_transaction_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if both parties have confirmed and status is completed
  IF NEW.provider_confirmed = true AND NEW.receiver_confirmed = true AND NEW.status = 'completed' THEN
    -- Transfer credits from receiver to provider
    UPDATE public.profiles 
    SET time_credits = time_credits - NEW.credits_amount
    WHERE user_id = NEW.receiver_id;
    
    UPDATE public.profiles 
    SET time_credits = time_credits + NEW.credits_amount
    WHERE user_id = NEW.provider_id;
    
    -- Set completion date
    NEW.completion_date = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for transaction completion
CREATE TRIGGER process_transaction_completion_trigger
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.process_transaction_completion();