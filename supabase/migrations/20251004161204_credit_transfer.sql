CREATE OR REPLACE FUNCTION transfer_credits(
    sender_id uuid,
    recipient_id uuid,
    service_id_arg uuid
) RETURNS void AS $$
DECLARE
    sender_profile RECORD;
    recipient_profile RECORD;
    service_record RECORD;
    calculated_amount integer;
BEGIN
    -- Get service details
    SELECT * INTO service_record FROM services WHERE id = service_id_arg;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Service not found';
    END IF;

    -- Calculate the total credits for the service
    calculated_amount := service_record.credits_per_hour * service_record.duration_hours;

    -- Lock profiles to prevent race conditions
    SELECT * INTO sender_profile FROM profiles WHERE user_id = sender_id FOR UPDATE;
    SELECT * INTO recipient_profile FROM profiles WHERE user_id = recipient_id FOR UPDATE;

    IF sender_profile IS NULL OR recipient_profile IS NULL THEN
        RAISE EXCEPTION 'Profile not found';
    END IF;

    -- Check if sender has enough credits
    IF sender_profile.time_credits < calculated_amount THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    -- Perform the transfer
    UPDATE profiles SET time_credits = time_credits - calculated_amount WHERE user_id = sender_id;
    UPDATE profiles SET time_credits = time_credits + calculated_amount WHERE user_id = recipient_id;

    -- Create a transaction record
    INSERT INTO transactions (service_id, provider_id, learner_id, credits_transferred, status)
    VALUES (service_id_arg, recipient_id, sender_id, calculated_amount, 'completed');

END;
$$ LANGUAGE plpgsql;
