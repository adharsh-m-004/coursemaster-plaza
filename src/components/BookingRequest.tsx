import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Calendar, Clock, Coins, MessageCircle, User } from "lucide-react";

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Service {
  id: string;
  title: string;
  duration_hours: number;
  credits_per_hour: number;
  provider_id: string;
}

interface Provider {
  full_name: string;
  rating: number;
  total_reviews: number;
}

interface BookingRequestProps {
  slot: AvailabilitySlot | null;
  service: Service;
  provider: Provider;
  learner_id: string;
  onClose: () => void;
  onBookingCreated: () => void;
}

const BookingRequest = ({ 
  slot, 
  service, 
  provider, 
  learner_id, 
  onClose, 
  onBookingCreated 
}: BookingRequestProps) => {
  const [learnerNotes, setLearnerNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!slot) return null;

  const totalCredits = service.credits_per_hour * service.duration_hours;

  const handleSubmitBooking = async () => {
    setIsSubmitting(true);
    try {
      // Check if user has enough credits
      const { data: userProfile, error: profileError } = await (supabase as any)
        .from("profiles" as any)
        .select("time_credits")
        .eq("user_id", learner_id)
        .single();

      if (profileError) throw profileError;

      if (userProfile.time_credits < totalCredits) {
        toast({
          title: "Insufficient Credits",
          description: `You need ${totalCredits} credits but only have ${userProfile.time_credits}`,
          variant: "destructive",
        });
        return;
      }

      // Create booking request
      const { error: bookingError } = await (supabase as any)
        .from("booking_requests" as any)
        .insert({
          availability_slot_id: slot.id,
          service_id: service.id,
          provider_id: service.provider_id,
          learner_id: learner_id,
          requested_start_time: slot.start_time,
          requested_end_time: slot.end_time,
          credits_amount: totalCredits,
          learner_notes: learnerNotes || null,
          status: 'pending'
        });

      if (bookingError) throw bookingError;

      toast({
        title: "Booking Request Sent!",
        description: "Your booking request has been sent to the provider. You'll be notified when they respond.",
      });

      onBookingCreated();
      onClose();
    } catch (error) {
      console.error("Error creating booking request:", error);
      toast({
        title: "Booking Failed",
        description: "Failed to create booking request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!slot} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Booking Request</DialogTitle>
          <DialogDescription>
            Review the details and send your booking request to the provider
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{service.title}</CardTitle>
              <CardDescription>with {provider.full_name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Date
                </span>
                <span className="font-medium">
                  {format(parseISO(slot.start_time), "EEEE, MMMM d, yyyy")}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Time
                </span>
                <span className="font-medium">
                  {format(parseISO(slot.start_time), "HH:mm")} - {format(parseISO(slot.end_time), "HH:mm")}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Duration
                </span>
                <span className="font-medium">{service.duration_hours} hour{service.duration_hours !== 1 ? 's' : ''}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Coins className="h-4 w-4" />
                  Total Cost
                </span>
                <Badge variant="secondary" className="font-medium">
                  {totalCredits} credits
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Provider Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <User className="h-4 w-4" />
                Provider Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <span>Rating</span>
                <span className="font-medium">
                  ⭐ {provider.rating.toFixed(1)} ({provider.total_reviews} reviews)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              Message to Provider (Optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Add any specific requirements or questions for the provider..."
              value={learnerNotes}
              onChange={(e) => setLearnerNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitBooking} 
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? "Sending..." : "Send Request"}
            </Button>
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <p>
              <strong>Note:</strong> Your credits will be held but not transferred until the session is completed. 
              You can cancel this request anytime before the provider confirms it.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingRequest;
