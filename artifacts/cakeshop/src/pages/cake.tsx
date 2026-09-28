import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetCake, getGetCakeQueryKey } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { ChevronLeft, Star, ZoomIn, X, ChevronDown, ChevronUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl } from "@/lib/api-base";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import { QuantityStepper } from "@/components/quantity-stepper";
import { cn, formatKes } from "@/lib/utils";
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
            className={`w-5 h-5 transition-colors ${filled ? "fill-primary text-primary" : "text-border"} ${onChange ? "cursor-pointer" : ""}`}
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
    <div className="rounded-2xl border border-border p-5">
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
  const [, setLocation] = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{ label: string; price: number } | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
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

  const hasVariants = !!cake?.variants && cake.variants.length > 0;
  const effectivePrice = selectedVariant?.price ?? cake?.price ?? 0;

  const handleAddToCart = () => {
    if (!cake) return;
    if (hasVariants && !selectedVariant) {
      toast({ title: "Please choose a size", description: "Select a size before adding to cart.", variant: "destructive" });
      return;
    }
    addItem(cake, quantity, selectedVariant?.label ?? null, selectedVariant?.price ?? null);
    toast({
      title: "Added to cart",
      description: `${quantity}x ${cake.name}${selectedVariant ? ` (${selectedVariant.label})` : ""} added to your cart.`,
      action: (
        <ToastAction altText="View cart" className="hover:bg-muted" onClick={() => setLocation("/cart")}>
          View cart
        </ToastAction>
      ),
    });
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
      <div className="mx-auto w-full max-w-5xl md:px-4 md:py-8">
        <div className="grid md:grid-cols-2 md:gap-10">
          <Skeleton className="aspect-square w-full rounded-none md:rounded-2xl" />
          <div className="space-y-4 px-4 pt-5 md:px-0 md:pt-0">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!cake) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">Cake not found</h1>
        <p className="text-sm text-muted-foreground mb-6">It may have been removed from the menu.</p>
        <Button asChild className="rounded-full px-6"><Link href="/">Back to shop</Link></Button>
      </div>
    );
  }

  const quantityStepper = (
    <QuantityStepper
      quantity={quantity}
      itemName={cake.name}
      disableDecrease={quantity <= 1}
      onDecrease={() => setQuantity(Math.max(1, quantity - 1))}
      onIncrease={() => setQuantity(quantity + 1)}
    />
  );
  const addToCartLabel = hasVariants && !selectedVariant ? "Choose a size" : `Add to cart · ${formatKes(effectivePrice * quantity)}`;

  return (
    <div className="mx-auto w-full max-w-5xl pb-10 md:px-4 md:pt-6">
      <Link href="/" className="mb-4 hidden items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-flex">
        <ChevronLeft className="mr-1 h-4 w-4" /> Back to shop
      </Link>

      <div className="grid items-start md:grid-cols-2 md:gap-10">
        {/* Image — click/tap to open lightbox */}
        <div className="relative">
          <div
            role="button"
            tabIndex={0}
            aria-label={`View ${cake.name} full size`}
            className="group relative aspect-square cursor-zoom-in overflow-hidden bg-muted md:rounded-2xl"
            onClick={() => setLightboxOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && setLightboxOpen(true)}
          >
            <RevealImage
              src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
              alt={cake.name}
              className="object-cover"
              fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
              placeholderClassName="bg-muted"
              eager
              timeoutMs={3000}
            />
            {/* Zoom hint: always visible on mobile, shows on hover on desktop */}
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <ZoomIn className="h-3.5 w-3.5 shrink-0" />
              <span>Tap to zoom</span>
            </div>
          </div>
          <Link
            href="/"
            aria-label="Back to shop"
            className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm md:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
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
        <div className="flex flex-col px-4 pt-5 md:px-0 md:pt-0">
          {cake.categoryName && (
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">{cake.categoryName}</p>
          )}
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{cake.name}</h1>

          {avgRating !== null && (
            <div className="mt-2 flex items-center gap-2">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-sm text-muted-foreground">
                {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
              </span>
            </div>
          )}

          <p className="mt-3 text-xl font-bold">
            {hasVariants && !selectedVariant
              ? `From ${formatKes(Math.min(...cake.variants!.map((v) => v.price)))}`
              : formatKes(effectivePrice)}
            {selectedVariant && (
              <span className="ml-2 text-sm font-medium text-muted-foreground">({selectedVariant.label})</span>
            )}
          </p>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {cake.description || "A delicious creation from Channah Cakes."}
          </p>

          {cake.available ? (
            <>
              {/* Size / variant selector */}
              {hasVariants && (
                <div className="mt-6" role="radiogroup" aria-labelledby="size-label">
                  <div className="flex items-center gap-2">
                    <p id="size-label" className="text-sm font-bold">Choose a size</p>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Required</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {cake.variants!.map((v) => {
                      const selected = selectedVariant?.label === v.label;
                      return (
                        <button
                          key={v.label}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setSelectedVariant(v)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                            selected ? "border-primary bg-accent" : "border-border hover:border-primary/50",
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              className={cn(
                                "flex h-5 w-5 items-center justify-center rounded-full border-2",
                                selected ? "border-primary" : "border-muted-foreground/40",
                              )}
                            >
                              {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                            </span>
                            <span className="font-medium">{v.label}</span>
                          </span>
                          <span className="font-semibold">{formatKes(v.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Desktop: inline add row. Mobile uses the sticky bar below. */}
              <div className="mt-6 hidden items-center gap-3 md:flex">
                {quantityStepper}
                <Button
                  size="lg"
                  className="h-12 flex-1 rounded-full text-base font-semibold"
                  onClick={handleAddToCart}
                  data-testid="button-add-to-cart"
                >
                  {addToCartLabel}
                </Button>
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-xl bg-muted px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
              Currently sold out
            </div>
          )}
        </div>
      </div>

      {cake.available && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-3">
            {quantityStepper}
            <Button className="h-12 flex-1 rounded-full text-base font-semibold" onClick={handleAddToCart}>
              {addToCartLabel}
            </Button>
          </div>
        </div>
      )}

      {/* ── REVIEWS ─────────────────────────────────── */}
      <div className="mx-4 mt-10 border-t border-border pt-8 md:mx-0">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Customer reviews</h2>
            {avgRating !== null && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {avgRating.toFixed(1)} out of 5 · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="rounded-full px-5"
            onClick={() => setShowReviewForm(!showReviewForm)}
            data-testid="button-write-review"
          >
            {showReviewForm ? "Cancel" : "Write a review"}
          </Button>
        </div>

        {/* Review form */}
        {showReviewForm && (
          <form onSubmit={handleSubmitReview} className="mb-8 rounded-2xl border border-border p-5 sm:p-6">
            <h3 className="mb-2 text-base font-bold">Share your experience</h3>
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
                className="rounded-full px-8"
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
          <div className="rounded-2xl bg-muted/60 px-6 py-10 text-center text-muted-foreground">
            <Star className="mx-auto mb-3 h-8 w-8 text-border" />
            <p className="text-sm font-semibold text-foreground">No reviews yet</p>
            <p className="text-sm">Be the first to share your experience with {cake.name}.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(reviewsExpanded ? reviews : reviews.slice(0, 4)).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
            {reviews.length > 4 && (
              <button
                type="button"
                onClick={() => setReviewsExpanded(!reviewsExpanded)}
                className="mx-auto mt-6 flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {reviewsExpanded ? (
                  <>Show less <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show all {reviews.length} reviews <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
