import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isAfter, isBefore, addMinutes } from "date-fns";
import { 
  Calendar, 
  Clock, 
  Coins, 
  MessageCircle, 
  User, 
  Check, 
  X, 
  Video,
  ExternalLink
} from "lucide-react";

interface BookingRequest {
  id: string;
  service_id: string;
  learner_id: string;
  requested_start_time: string;
  requested_end_time: string;
  status: string;
  credits_amount: number;
  learner_notes?: string;
  provider_notes?: string;
  google_meet_link?: string;
  confirmed_at?: string;
  created_at: string;
  provider_confirmed?: boolean;
  learner_confirmed?: boolean;
  dispute_status?: 'none' | 'open' | 'resolved';
  services: {
    title: string;
  };
  profiles: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface BookingManagementProps {
  providerId: string;
}

const BookingManagement = ({ providerId }: BookingManagementProps) => {
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [providerNotes, setProviderNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadBookingRequests();
  }, [providerId]);

  const loadBookingRequests = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("booking_requests" as any)
        .select(`
          *,
          services (title),
          profiles!booking_requests_learner_id_fkey (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookingRequests((data || []) as any);
    } catch (error) {
      console.error("Error loading booking requests:", error);
      toast({
        title: "Error",
        description: "Failed to load booking requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookingAction = async (bookingId: string, action: 'confirm' | 'decline') => {
    setIsProcessing(true);
    try {
      let updateData: any = {
        status: action === 'confirm' ? 'confirmed' : 'declined',
        provider_notes: providerNotes || null,
      };

      // Create an immediate meeting link via Edge Function if confirming
      if (action === 'confirm') {
        try {
          const { data, error } = await (supabase as any).functions.invoke('create_meeting', {
            body: { booking_id: bookingId },
          });

          if (error) {
            console.error('create_meeting error:', error);
          } else if (data?.link) {
            updateData.google_meet_link = data.link;
          }
        } catch (fnErr) {
          console.error('Error invoking create_meeting:', fnErr);
        }
      }

      const { error } = await (supabase as any)
        .from("booking_requests" as any)
        .update(updateData)
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: action === 'confirm' ? "Booking Confirmed" : "Booking Declined",
        description: `The booking request has been ${action === 'confirm' ? 'confirmed' : 'declined'}.`,
      });

      setSelectedBooking(null);
      setProviderNotes("");
      loadBookingRequests();
    } catch (error) {
      console.error(`Error ${action}ing booking:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} booking request`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmSession = async (bookingId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await (supabase as any)
        .from("booking_requests" as any)
        .update({ provider_confirmed: true })
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: "Confirmation Recorded",
        description: "Your confirmation has been recorded. Credits will transfer once both parties confirm.",
      });

      loadBookingRequests();
    } catch (error) {
      console.error("Error confirming session:", error);
      toast({
        title: "Error",
        description: "Failed to confirm session",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const openDispute = async (bookingId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await (supabase as any)
        .from("booking_requests" as any)
        .update({ dispute_status: 'open', dispute_opened_by: providerId, dispute_reason: providerNotes || null })
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: "Dispute Opened",
        description: "This booking has been flagged for review. Our team will follow up.",
      });

      setSelectedBooking(null);
      setProviderNotes("");
      loadBookingRequests();
    } catch (error) {
      console.error("Error opening dispute:", error);
      toast({
        title: "Error",
        description: "Failed to open dispute",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filterBookings = (status: string) => {
    if (status === 'all') return bookingRequests;
    return bookingRequests.filter(booking => booking.status === status);
  };

  const BookingCard = ({ booking }: { booking: BookingRequest }) => {
    const sessionTime = parseISO(booking.requested_start_time);
    const now = new Date();
    const isUpcoming = isAfter(sessionTime, now);
    const endTime = parseISO(booking.requested_end_time);
    const isInProgress = isAfter(now, sessionTime) && isBefore(now, endTime);
    const canConfirm = booking.status === 'confirmed' && isAfter(now, endTime);

    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" 
            onClick={() => setSelectedBooking(booking)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{booking.services.title}</CardTitle>
              <CardDescription>with {booking.profiles.full_name}</CardDescription>
            </div>
            <Badge className={getStatusColor(booking.status)}>
              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            <span>{format(sessionTime, "EEEE, MMMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            <span>
              {format(sessionTime, "HH:mm")} - {format(parseISO(booking.requested_end_time), "HH:mm")}
            </span>
            {isInProgress && <Badge variant="destructive" className="text-xs">Live Now</Badge>}
            {isUpcoming && booking.status === 'confirmed' && <Badge variant="default" className="text-xs">Upcoming</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Coins className="h-4 w-4" />
            <span>{booking.credits_amount} credits</span>
          </div>
          {(() => {
            const now = new Date();
            const start = parseISO(booking.requested_start_time);
            const end = parseISO(booking.requested_end_time);
            const inWindow = isAfter(now, addMinutes(start, -15)) && isBefore(now, addMinutes(end, 10));
            if (booking.google_meet_link && booking.status === 'confirmed' && inWindow) {
              return (
                <div className="flex items-center gap-2 text-sm">
                  <Video className="h-4 w-4" />
                  <button
                    className="text-blue-600 underline"
                    onClick={(e) => { e.stopPropagation(); window.open(booking.google_meet_link as string, '_blank'); }}
                  >
                    Join Meeting
                  </button>
                </div>
              );
            }
            return null;
          })()}
          {canConfirm && !booking.provider_confirmed && (
            <div className="space-y-2">
              <Button 
                size="sm" 
                className="w-full mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  confirmSession(booking.id);
                }}
                disabled={isProcessing}
              >
                I Confirm This Session
              </Button>
              <Button 
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  openDispute(booking.id);
                }}
                disabled={isProcessing}
              >
                Report an Issue
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Booking Management</CardTitle>
          <CardDescription>
            Manage your booking requests and scheduled sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="declined">Declined</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>

            {['pending', 'confirmed', 'completed', 'declined', 'all'].map((status) => (
              <TabsContent key={status} value={status} className="space-y-4">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading booking requests...</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filterBookings(status).map((booking) => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))}
                    {filterBookings(status).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No {status === 'all' ? '' : status} booking requests found.
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Booking Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-md">
          {selectedBooking && (
            <>
              <DialogHeader>
                <DialogTitle>Booking Request Details</DialogTitle>
                <DialogDescription>
                  Review and respond to this booking request
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Service & Learner Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{selectedBooking.services.title}</CardTitle>
                    <CardDescription>
                      Requested by {selectedBooking.profiles.full_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Date</span>
                      <span className="font-medium">
                        {format(parseISO(selectedBooking.requested_start_time), "EEEE, MMMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Time</span>
                      <span className="font-medium">
                        {format(parseISO(selectedBooking.requested_start_time), "HH:mm")} - 
                        {format(parseISO(selectedBooking.requested_end_time), "HH:mm")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Credits</span>
                      <Badge variant="secondary">{selectedBooking.credits_amount} credits</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Status</span>
                      <Badge className={getStatusColor(selectedBooking.status)}>
                        {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Learner Notes */}
                {selectedBooking.learner_notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Message from Learner</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {selectedBooking.learner_notes}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Meeting Link (only during session window) */}
                {(() => {
                  if (!selectedBooking.google_meet_link) return null;
                  const now = new Date();
                  const start = parseISO(selectedBooking.requested_start_time);
                  const end = parseISO(selectedBooking.requested_end_time);
                  const inWindow = isAfter(now, addMinutes(start, -15)) && isBefore(now, addMinutes(end, 10));
                  if (!(selectedBooking.status === 'confirmed' && inWindow)) return null;
                  return (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-1">
                          <Video className="h-4 w-4" />
                          Meeting Link
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => window.open(selectedBooking.google_meet_link as string, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Join Meeting
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Provider Response / Actions */}
                {selectedBooking.status === 'pending' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="provider-notes">Response Message (Optional)</Label>
                      <Textarea
                        id="provider-notes"
                        placeholder="Add any notes or instructions for the learner..."
                        value={providerNotes}
                        onChange={(e) => setProviderNotes(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleBookingAction(selectedBooking.id, 'decline')}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Decline
                      </Button>
                      <Button
                        onClick={() => handleBookingAction(selectedBooking.id, 'confirm')}
                        disabled={isProcessing}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Confirm
                      </Button>
                    </div>
                  </div>
                )}

                {/* Provider Notes Display */}
                {selectedBooking.provider_notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Your Response</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {selectedBooking.provider_notes}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingManagement;
