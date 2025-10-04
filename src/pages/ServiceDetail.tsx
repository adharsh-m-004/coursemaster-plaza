// @ts-nocheck
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User } from '@supabase/supabase-js';
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import BookingRequest from "@/components/BookingRequest";
import ReviewForm from "@/components/ReviewForm";
import { 
  Coins, 
  Clock, 
  Star, 
  MapPin, 
  ArrowLeft, 
  Calendar,
  MessageCircle,
  BookmarkPlus 
} from "lucide-react";

interface Service {
  id: string;
  provider_id: string;
  title: string;
  description: string;
  category: string;
  duration_hours: number;
  credits_per_hour: number;
  location?: string;
  tags?: string[];
  created_at: string;
}

interface Provider {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  rating: number;
  total_reviews: number;
  location?: string;
  bio?: string;
  skills?: string[];
  avatar_url?: string;
}

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url?: string;
  };
}

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const ServiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [completedTransactionId, setCompletedTransactionId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadServiceData = async (serviceId: string) => {
    try {
      setIsLoading(true);
      // Load service details
      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .single();

      if (serviceError) throw serviceError;
      setService(serviceData);

      // Load provider details
      const { data: providerData, error: providerError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", serviceData.provider_id)
        .single();

      if (providerError) throw providerError;
      setProvider(providerData);

      // Load reviews for this service
      const { data: reviewsData, error: reviewsError } = await (supabase as any)
        .from("reviews" as any)
        .select(`
          *,
          profiles!reviews_reviewer_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq("service_id", serviceData.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (reviewsError) throw reviewsError;
      setReviews(reviewsData || []);

    } catch (error) {
      console.error("Error loading service data:", error);
      toast({
        title: "Error",
        description: "Failed to load service details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkReviewEligibility = async (serviceId: string, userId: string) => {
    if (!serviceId || !userId) return;

    try {
      // Check for a completed booking for this service by the user
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status')
        .eq('service_id', serviceId)
        .eq('learner_id', userId)
        .eq('status', 'completed')
        .limit(1)
        .single();

      if (bookingError && bookingError.code !== 'PGRST116') throw bookingError;

      if (!booking) {
        setCanReview(false);
        return;
      }

      // Check if a review already exists for this transaction
      const { data: existingReview, error: reviewError } = await supabase
        .from('reviews')
        .select('id')
        .eq('transaction_id', booking.id)
        .eq('reviewer_id', userId)
        .single();

      if (reviewError && reviewError.code !== 'PGRST116') throw reviewError;

      if (existingReview) {
        setHasReviewed(true);
        setCanReview(false);
      } else {
        setHasReviewed(false);
        setCanReview(true);
        setCompletedTransactionId(booking.id);
      }
    } catch (error) {
      console.error("Error checking review eligibility:", error);
      setCanReview(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      
      if (id) {
        await loadServiceData(id);
        await checkReviewEligibility(id, session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, id]);

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
  };

  const handleBookingCreated = () => {
    toast({
      title: "Booking Request Sent!",
      description: "Your booking request has been sent to the provider. You'll be notified when they respond.",
    });
    navigate("/dashboard");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading service details...</p>
        </div>
      </div>
    );
  }

  if (!service || !provider) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Service Not Found</h2>
          <p className="text-muted-foreground mb-4">The service you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const totalCredits = service.credits_per_hour * service.duration_hours;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              <span className="font-medium">SkillSwap</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Service Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl mb-2">{service.title}</CardTitle>
                    <CardDescription className="text-base">
                      <Badge variant="secondary" className="mr-2">{service.category}</Badge>
                      {service.location && (
                        <span className="flex items-center gap-1 mt-2">
                          <MapPin className="h-4 w-4" />
                          {service.location}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">
                      {totalCredits} credits
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {service.credits_per_hour}/hr × {service.duration_hours}h
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Description</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {service.description}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{service.duration_hours} hour{service.duration_hours !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins className="h-4 w-4" />
                      <span>{service.credits_per_hour} credits per hour</span>
                    </div>
                  </div>

                  {service.tags && service.tags.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {service.tags.map((tag, index) => (
                          <Badge key={index} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Availability Section */}
            {user?.id !== provider.user_id && (
              <div id="availability-section">
                <AvailabilityCalendar
                  serviceId={service.id}
                  providerId={service.provider_id}
                  mode="view"
                  onSlotSelect={handleSlotSelect}
                />
              </div>
            )}

            {/* Service Reviews */}
            <Card>
              <CardHeader>
                <CardTitle>Service Reviews</CardTitle>
                <CardDescription>What learners say about this specific service</CardDescription>
              </CardHeader>
              <CardContent>
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b pb-4 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={review.profiles.avatar_url} />
                            <AvatarFallback>
                              {review.profiles.full_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {review.profiles.full_name}
                              </span>
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${
                                      i < review.rating 
                                        ? "text-yellow-500 fill-current" 
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(review.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {review.comment && (
                              <p className="text-sm text-muted-foreground">
                                {review.comment}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No reviews yet for this service.</p>
                )}

                {user && canReview && completedTransactionId && provider && (
                  <ReviewForm 
                    transactionId={completedTransactionId}
                    revieweeId={provider.user_id}
                    reviewerId={user.id}
                    onReviewSubmit={async () => {
                      if (!service) return;
                      await loadServiceData(service.id);
                      await checkReviewEligibility(service.id, user.id);
                    }}
                  />
                )}

                {user && hasReviewed && (
                  <div className="text-center text-sm text-muted-foreground pt-4 border-t mt-6">
                    <p>You've already reviewed this service. Thank you for your feedback!</p>
                  </div>
                )}

                {user && !canReview && !hasReviewed && user.id !== provider?.user_id && (
                  <div className="text-center text-sm text-muted-foreground pt-4 border-t mt-6">
                    <p>You can write a review after a completed session with this provider.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Provider Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-3 mb-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={provider.avatar_url} />
                    <AvatarFallback>{provider.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold">{provider.full_name}</h3>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span>{provider.rating.toFixed(1)}</span>
                      <span className="text-muted-foreground">
                        ({provider.total_reviews} reviews)
                      </span>
                    </div>
                    {provider.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{provider.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {provider.bio && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">{provider.bio}</p>
                  </div>
                )}

                {provider.skills && provider.skills.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-sm mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-1">
                      {provider.skills.slice(0, 5).map((skill, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {provider.skills.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{provider.skills.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <Separator className="my-4" />

                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={() => document.getElementById('availability-section')?.scrollIntoView({ behavior: 'smooth' })}
                    disabled={user?.id === provider.user_id}
                  >
                    {user?.id === provider.user_id ? (
                      "Your Service"
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" />
                        View Availability
                      </>
                    )}
                  </Button>
                  
                  <Button variant="outline" className="w-full">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message Provider
                  </Button>
                  
                  <Button variant="ghost" className="w-full">
                    <BookmarkPlus className="h-4 w-4 mr-2" />
                    Save Service
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-medium">{service.duration_hours} hour{service.duration_hours !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-medium">{service.credits_per_hour} credits/hr</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-medium text-primary">{totalCredits} credits</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="secondary" className="text-xs">{service.category}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Booking Request Dialog */}
      {selectedSlot && service && provider && user && (
        <BookingRequest
          slot={selectedSlot}
          service={service}
          provider={provider}
          learner_id={user.id}
          onClose={() => setSelectedSlot(null)}
          onBookingCreated={handleBookingCreated}
        />
      )}
    </div>
  );
};

export default ServiceDetail;