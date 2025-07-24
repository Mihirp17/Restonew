import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { Star } from "lucide-react";
import { useLang } from "@/contexts/language-context";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const { restaurantId, session } = useRestaurant();
  const { toast } = useToast();
  const { t } = useLang();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast({
        title: t('feedback.toast.ratingRequired.title'),
        description: t('feedback.toast.ratingRequired.description'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/restaurants/${restaurantId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
          tableSessionId: session?.id,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit feedback");
      
      setRating(0);
      setComment("");
      onOpenChange(false);

      toast({
        title: t('feedback.toast.success.title'),
        description: t('feedback.toast.success.description'),
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: t('feedback.toast.failed.title'),
        description: t('feedback.toast.failed.description'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStarClick = (starRating: number) => {
    setRating(starRating);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-black">{t('feedback.title')}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <Label className="font-medium text-black">{t('feedback.rating.label')}</Label>
            <div className="flex space-x-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleStarClick(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {rating === 0 && t('feedback.rating.clickToRate')}
              {rating === 1 && t('feedback.rating.poor')}
              {rating === 2 && t('feedback.rating.fair')}
              {rating === 3 && t('feedback.rating.good')}
              {rating === 4 && t('feedback.rating.veryGood')}
              {rating === 5 && t('feedback.rating.excellent')}
            </p>
          </div>
          
          <div>
            <Label htmlFor="comment" className="font-medium text-black">{t('feedback.comments.label')}</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('feedback.comments.placeholder')}
              rows={4}
              className="rounded-lg bg-gray-100 mt-1"
            />
          </div>
          
          <Button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white rounded-lg hover:bg-red-700">
            {isSubmitting ? t('feedback.button.submitting') : t('feedback.button.submit')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
