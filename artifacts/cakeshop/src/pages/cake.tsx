import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetCake, getGetCakeQueryKey } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Minus, Plus, ShoppingBag, ChevronLeft, Star, ZoomIn, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl } from "@/lib/api-base";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface Review {
  id: number;
  cakeId: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < (onChange ? hovered || rating : rating);
        return (
          <Star
            key={i}
            className={`w-5 h-5 transition-colors ${filled ? "fill-[#c9a96e] text-[#c9a96e]" : "text-border"} ${onChange ? "cursor-pointer" : ""}`}
            onMouseEnter={() => onChange && setHovered(i + 1)}
            onMouseLeave={() => onChange && setHovered(0)}
            onClick={() => onChange && onChange(i + 1)}
          />
        );
      })}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-border/40 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-foreground text-sm">{review.authorName}</p>
          <p className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <StarRating rating={review.rating} />
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">{review.body}</p>
    </div>
  );
}

export default function CakeDetail() {
  const { id } = useParams();
  const cakeId = Number(id);
  const { data: cake, isLoading } = useGetCake(cakeId, {
    query: { enabled: !!cakeId, queryKey: getGetCakeQueryKey(cakeId) }
  });

  const { addItem } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{ label: string; price: number } | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewOrderId, setReviewOrderId] = useState("");
  const [reviewPhone, setReviewPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!cakeId) return;
    fetch(`${getApiBaseUrl()}/api/reviews/cake/${cakeId}`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(Array.isArray(data) ? data : []);
        setReviewsLoading(false);
      })
      .catch(() => setReviewsLoading(false));
  }, [cakeId]);

  const effectivePrice = selectedVariant?.price ?? cake?.price ?? 0;

  const handleAddToCart = () => {
    if (!cake) return;
    if (cake.variants && cake.variants.length > 0 && !selectedVariant) {
      toast({ title: "Please choose a size", description: "Select a size before adding to cart.", variant: "destructive" });
      return;
    }
    addItem(cake, quantity, selectedVariant?.label ?? null, selectedVariant?.price ?? null);
    toast({ title: "Added to cart", description: `${quantity}x ${cake.name}${selectedVariant ? ` (${selectedVariant.label})` : ""} added to your cart.` });
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewBody.trim() || reviewRating < 1 || !reviewOrderId.trim() || !reviewPhone.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cakeId,
          authorName: reviewName,
          body: reviewBody,
          rating: reviewRating,
          orderId: Number(reviewOrderId),
          customerPhone: reviewPhone,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit review");
      const newReview = await res.json();
      setReviews((prev) => [newReview, ...prev]);
      setReviewName("");
      setReviewBody("");
      setReviewRating(5);
      setReviewOrderId("");
      setReviewPhone("");
      setShowReviewForm(false);
      toast({ title: "Review submitted", description: "Thank you for your feedback!" });
    } catch {
      toast({ title: "Could not submit review", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-6">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!cake) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">Cake not found</h1>
        <Button asChild><Link href="/menu">Back to Menu</Link></Button>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="container mx-auto px-4 py-12">
        <Link href="/menu" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Menu
        </Link>

        <div className="grid md:grid-cols-2 gap-12 items-start">
          {/* Image — click/tap to open lightbox */}
          <div
            role="button"
            tabIndex={0}
            aria-label={`View ${cake.name} full size`}
            className="bg-card rounded-3xl overflow-hidden border border-border shadow-sm cursor-zoom-in group relative"
            onClick={() => setLightboxOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && setLightboxOpen(true)}
          >
            <div className="aspect-square relative">
              <RevealImage
                src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                alt={cake.name}
                className="object-cover"
                fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                eager
                timeoutMs={3000}
              />
              {/* Zoom hint: always visible on mobile, shows on hover on desktop */}
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-2 rounded-full pointer-events-none transition-opacity md:opacity-0 md:group-hover:opacity-100">
                <ZoomIn className="w-3.5 h-3.5 shrink-0" />
                <span>Tap to zoom</span>
              </div>
            </div>
          </div>

          {/* Lightbox */}
          <DialogPrimitive.Root open={lightboxOpen} onOpenChange={setLightboxOpen}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
              <DialogPrimitive.Content
                className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200 outline-none"
                aria-describedby={undefined}
              >
                <DialogPrimitive.Title className="sr-only">{cake.name} — full size image</DialogPrimitive.Title>
                <img
                  src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                  alt={cake.name}
                  className="rounded-2xl object-contain"
                  style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 80px)" }}
                />
                <DialogPrimitive.Close className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors backdrop-blur-sm">
                  <X className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          {/* Details */}
          <div className="flex flex-col">
            {cake.categoryName && (
              <p className="text-[#c9a96e] font-semibold uppercase tracking-wider text-sm mb-2">
                {cake.categoryName}
              </p>
            )}
            <h1 className="font-serif text-4xl md:text-5xl font-bold mb-3 text-foreground">{cake.name}</h1>

            {avgRating !== null && (
              <div className="flex items-center gap-2 mb-4">
                <StarRating rating={Math.round(avgRating)} />
                <span className="text-sm text-muted-foreground">
                  {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}

            <p className="text-2xl font-medium text-foreground mb-6">
              KES {effectivePrice.toLocaleString()}
              {selectedVariant && cake.variants && cake.variants.length > 0 && (
                <span className="ml-2 text-base font-normal text-muted-foreground">({selectedVariant.label})</span>
              )}
            </p>

            <div className="prose prose-sm md:prose-base text-muted-foreground mb-8">
              <p>{cake.description || "A delicious creation from Channah Cakes."}</p>
            </div>

            {cake.available ? (
              <div className="space-y-6 mt-auto">
                {/* Size / variant selector */}
                {cake.variants && cake.variants.length > 0 && (
                  <div>
                    <p className="font-medium mb-3">Size:</p>
                    <div className="flex flex-wrap gap-2">
                      {cake.variants.map((v) => (
                        <button
                          key={v.label}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                            selectedVariant?.label === v.label
                              ? "border-primary bg-primary text-white shadow-sm"
                              : "border-border bg-card text-foreground hover:border-primary/60"
                          }`}
                        >
                          {v.label}
                          <span className={`ml-2 text-xs ${selectedVariant?.label === v.label ? "text-white/75" : "text-muted-foreground"}`}>
                            KES {v.price.toLocaleString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <span className="font-medium">Quantity:</span>
                  <div className="flex items-center border border-border rounded-full bg-card p-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      data-testid="button-qty-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-medium" data-testid="text-quantity">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={() => setQuantity(quantity + 1)}
                      data-testid="button-qty-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full h-14 text-base font-semibold rounded-full bg-primary hover:bg-primary/90 text-white"
                  onClick={handleAddToCart}
                  data-testid="button-add-to-cart"
                >
                  <ShoppingBag className="w-5 h-5 mr-2" />
                  Add to Cart — KES {(effectivePrice * quantity).toLocaleString()}
                </Button>
              </div>
            ) : (
              <div className="mt-auto">
                <div className="bg-muted text-muted-foreground px-6 py-4 rounded-xl text-center font-medium">
                  Currently Sold Out
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── REVIEWS ─────────────────────────────────── */}
        <div className="mt-20 pt-12 border-t border-border">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-3xl font-bold text-foreground">Customer Reviews</h2>
              {avgRating !== null && (
                <p className="text-muted-foreground text-sm mt-1">
                  Average rating: {avgRating.toFixed(1)} / 5 from {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="rounded-full px-6"
              onClick={() => setShowReviewForm(!showReviewForm)}
              data-testid="button-write-review"
            >
              {showReviewForm ? "Cancel" : "Write a Review"}
            </Button>
          </div>

          {/* Review form */}
          {showReviewForm && (
            <form onSubmit={handleSubmitReview} className="bg-white rounded-2xl p-8 border border-border/40 shadow-sm mb-8">
              <h3 className="font-serif text-xl font-bold mb-6 text-foreground">Share Your Experience</h3>
              <p className="mb-6 text-sm leading-6 text-muted-foreground">
                Reviews are only accepted after a paid purchase. Enter your order number and the phone number used at checkout to verify your order.
              </p>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Your Rating</Label>
                  <StarRating rating={reviewRating} onChange={setReviewRating} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-order-id">Order Number</Label>
                  <Input
                    id="review-order-id"
                    value={reviewOrderId}
                    onChange={(e) => setReviewOrderId(e.target.value)}
                    placeholder="e.g. 123"
                    inputMode="numeric"
                    required
                    className="rounded-xl"
                    data-testid="input-review-order-id"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-phone">Phone Used at Checkout</Label>
                  <Input
                    id="review-phone"
                    value={reviewPhone}
                    onChange={(e) => setReviewPhone(e.target.value)}
                    placeholder="e.g. 07xx xxx xxx"
                    required
                    className="rounded-xl"
                    data-testid="input-review-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-name">Your Name</Label>
                  <Input
                    id="review-name"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    placeholder="e.g. Amina S."
                    required
                    className="rounded-xl"
                    data-testid="input-review-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-body">Your Review</Label>
                  <Textarea
                    id="review-body"
                    value={reviewBody}
                    onChange={(e) => setReviewBody(e.target.value)}
                    placeholder="Tell us what you loved about this cake…"
                    required
                    rows={4}
                    className="rounded-xl resize-none"
                    data-testid="input-review-body"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting || !reviewName.trim() || !reviewBody.trim() || !reviewOrderId.trim() || !reviewPhone.trim()}
                  className="rounded-full px-8 bg-primary hover:bg-primary/90 text-white"
                  data-testid="button-submit-review"
                >
                  {submitting ? "Submitting…" : "Submit Review"}
                </Button>
              </div>
            </form>
          )}

          {/* Reviews list */}
          {reviewsLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Star className="w-10 h-10 mx-auto mb-3 text-border" />
              <p className="font-medium">No reviews yet</p>
              <p className="text-sm">Be the first to share your experience with {cake.name}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
