import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";

interface Review {
  id: string;
  reviewer_id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url?: string | null;
  };
}

interface ReviewsPanelProps {
  serviceId: string;
}

const ReviewsPanel = ({ serviceId }: ReviewsPanelProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("reviews" as any)
          .select(`
            *,
            profiles!reviews_reviewer_id_fkey (
              full_name,
              avatar_url
            )
          `)
          .eq("service_id", serviceId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (error) throw error;
        setReviews(data || []);
      } catch (e) {
        console.error("ReviewsPanel: failed to load reviews", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [serviceId]);

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle className="text-base">Service Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="text-sm text-muted-foreground">No reviews yet for this service.</div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="border-b pb-4 last:border-b-0">
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={review.profiles?.avatar_url || undefined} />
                    <AvatarFallback>
                      {review.profiles?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {review.profiles?.full_name || "User"}
                      </span>
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < (review.rating || 0) ? "text-yellow-500 fill-current" : "text-gray-300"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReviewsPanel;
