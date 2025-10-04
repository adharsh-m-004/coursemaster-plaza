import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";

interface ReviewFormProps {
  transactionId: string;
  revieweeId: string;
  reviewerId: string;
  onReviewSubmit: () => void;
}

const ReviewForm = ({ transactionId, revieweeId, reviewerId, onReviewSubmit }: ReviewFormProps) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({
        title: "Rating required",
        description: "Please select a star rating before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").insert([
        {
          transaction_id: transactionId,
          reviewee_id: revieweeId,
          reviewer_id: reviewerId,
          rating,
          comment,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Review Submitted!",
        description: "Thank you for your feedback.",
      });
      onReviewSubmit(); // Callback to refresh parent component
    } catch (error: any) {
      console.error("Error submitting review:", error);
      const errorMessage = error.message?.includes('check constraint')
        ? "A review for this service already exists."
        : "Failed to submit your review. Please try again.";

      toast({
        title: "Error Submitting Review",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-6 pt-6 border-t">
      <h3 className="text-lg font-semibold">Write a Review</h3>
      <div>
        <label className="text-sm font-medium mb-2 block">Your Rating</label>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => {
            const starValue = i + 1;
            return (
              <Star
                key={starValue}
                className={`h-6 w-6 cursor-pointer transition-colors ${
                  starValue <= (hoverRating || rating)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-gray-300"
                }`}
                onClick={() => setRating(starValue)}
                onMouseEnter={() => setHoverRating(starValue)}
                onMouseLeave={() => setHoverRating(0)}
              />
            );
          })}
        </div>
      </div>
      <div>
        <label htmlFor="comment" className="text-sm font-medium mb-2 block">Your Review</label>
        <Textarea
          id="comment"
          placeholder="Share your experience with this service..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
        />
      </div>
      <Button type="submit" disabled={isSubmitting || rating === 0}>
        {isSubmitting ? "Submitting..." : "Submit Review"}
      </Button>
    </form>
  );
};

export default ReviewForm;
