import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetCake,
  useListCakes,
  getGetCakeQueryKey,
  getGetPopularCakesQueryKey,
  getListCakesQueryKey,
  type Cake,
} from "@workspace/api-client-react";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToastAction } from "@/components/ui/toast";
import { ChevronLeft, Star, ZoomIn, X, ChevronDown, ChevronUp, Share2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiBaseUrl } from "@/lib/api-base";
import { cakeSizes, offersSecondFlavour, useCakeOptions } from "@/lib/cake-options";
import { hasInAppHistory } from "@/lib/navigation-history";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import { ProductCard } from "@/components/product-card";
import { QuantityStepper } from "@/components/quantity-stepper";
import { cn, formatKes } from "@/lib/utils";
import { normalizeKenyanPhone } from "@/lib/phone";
import * as DialogPrimitive from "@radix-ui/react-dialog";

const CAKE_MESSAGE_MAX_LENGTH = 60;

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

// A plain list of radio rows, like the option groups on the Take App product page.
function OptionGroup({
  id,
  label,
  ariaLabel,
  hint,
  required,
  error,
  options,
  value,
  onChange,
  onClear,
}: {
  id: string;
  label?: string;
  // Names the group for screen readers when there is no visible label.
  ariaLabel?: string;
  hint?: string;
  required?: boolean;
  error?: string | null;
  options: { value: string; label: string; price?: string }[];
  value: string | null;
  onChange: (value: string) => void;
  onClear?: () => void;
}) {
  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={label ? `${id}-label` : undefined}
      aria-label={label ? undefined : ariaLabel}
      aria-required={required || undefined}
      className="scroll-mt-24"
    >
      {label && (
        <p id={`${id}-label`} className="mb-2 text-sm font-bold">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </p>
      )}
      {hint && <p className="-mt-1.5 mb-2 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mb-2 text-sm font-medium text-destructive">{error}</p>}
      <div className="-mx-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors hover:bg-muted/70"
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-foreground" : "border-muted-foreground/40",
                )}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-foreground" />}
              </span>
              <span className="flex-1 leading-snug">{option.label}</span>
              {option.price && <span className="shrink-0 font-semibold">{option.price}</span>}
            </button>
          );
        })}
      </div>
      {onClear && value && (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}

export default function CakeDetail() {
  const { id } = useParams();
  const cakeId = Number(id);
  const queryClient = useQueryClient();
  // The shop page has already loaded this cake, so show it straight away while fresh data loads.
  const cakeFromShopPage = () =>
    [
      ...queryClient.getQueriesData<Cake[]>({ queryKey: getListCakesQueryKey() }),
      ...queryClient.getQueriesData<Cake[]>({ queryKey: getGetPopularCakesQueryKey() }),
    ]
      .flatMap(([, cakes]) => cakes ?? [])
      .find((listedCake) => listedCake.id === cakeId);
  const { data: cake, isLoading } = useGetCake(cakeId, {
    query: { enabled: !!cakeId, queryKey: getGetCakeQueryKey(cakeId), placeholderData: cakeFromShopPage }
  });
  const { data: allCakes } = useListCakes();
  // The shop's flavours and standard sizes; the choices wait for them so nobody picks from the wrong list.
  const cakeOptions = useCakeOptions();
  const flavours = cakeOptions?.flavours ?? [];

  const { addItem } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedSizeLabel, setSelectedSizeLabel] = useState<string | null>(null);
  const [flavour, setFlavour] = useState<string | null>(null);
  const [secondFlavour, setSecondFlavour] = useState<string | null>(null);
  const [flavourError, setFlavourError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionClamped, setDescriptionClamped] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

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

  // Opening another cake (e.g. from "You may also like") starts with fresh choices.
  useEffect(() => {
    setQuantity(1);
    setSelectedSizeLabel(null);
    setFlavour(null);
    setSecondFlavour(null);
    setFlavourError(null);
    setMessage("");
    setDescriptionExpanded(false);
  }, [cakeId]);

  useEffect(() => {
    if (!cakeId) return;
    setReviewsLoading(true);
    fetch(`${getApiBaseUrl()}/api/reviews/cake/${cakeId}`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(Array.isArray(data) ? data : []);
        setReviewsLoading(false);
      })
      .catch(() => setReviewsLoading(false));
  }, [cakeId]);

  // Only offer "Show more" when the description is actually cut off.
  useLayoutEffect(() => {
    const element = descriptionRef.current;
    if (element && !descriptionExpanded) {
      setDescriptionClamped(element.scrollHeight > element.clientHeight + 1);
    }
  }, [cake?.description, descriptionExpanded]);

  const variants = cake ? cakeSizes(cake, cakeOptions) : [];
  const hasVariants = variants.length > 0;
  // Like the sample shop, the first size is chosen until the customer picks another.
  const selectedVariant = hasVariants ? variants.find((v) => v.label === selectedSizeLabel) ?? variants[0] : null;
  const unitPrice = selectedVariant?.price ?? cake?.price ?? 0;
  const needsFlavour = flavours.length > 0;
  const readyToAdd = !!cakeOptions && (!needsFlavour || !!flavour);
  const flavourOptions = flavours.map((f) => ({ value: f.name, label: f.description ? `${f.name} — ${f.description}` : f.name }));
  // Bigger cakes (e.g. tiered ones) can have a second flavour when the shop allows it for the chosen size.
  const showSecondFlavour = !!cakeOptions && offersSecondFlavour(cakeOptions, selectedVariant?.label);

  const priceText = hasVariants
    ? (() => {
        const prices = variants.map((v) => v.price);
        const low = Math.min(...prices);
        const high = Math.max(...prices);
        return low === high ? formatKes(low) : `${formatKes(low)} – ${formatKes(high)}`;
      })()
    : formatKes(cake?.price ?? 0);

  const relatedCakes = (() => {
    if (!cake || !allCakes) return [];
    const others = allCakes.filter((other) => other.id !== cake.id && other.available);
    const sameCategory = others.filter((other) => other.categoryId != null && other.categoryId === cake.categoryId);
    return [...sameCategory, ...others.filter((other) => !sameCategory.includes(other))].slice(0, 4);
  })();

  const goBack = () => {
    if (hasInAppHistory()) {
      window.history.back();
    } else {
      setLocation("/");
    }
  };

  const handleShare = async () => {
    if (!cake) return;
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: cake.name, url });
      } catch {
        // Closing the share sheet rejects; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Send it to friends and family." });
    } catch {
      toast({ title: "Share this link", description: url });
    }
  };

  const handleAddToCart = () => {
    if (!cake || !cakeOptions) return;
    if (needsFlavour && !flavour) {
      setFlavourError("Please choose a flavour");
      document.getElementById("flavour-options")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    addItem(cake, quantity, {
      variantLabel: selectedVariant?.label ?? null,
      variantPrice: selectedVariant?.price ?? null,
      flavour,
      secondFlavour: showSecondFlavour ? secondFlavour : null,
      message,
    });
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
          customerPhone: normalizeKenyanPhone(reviewPhone),
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
      <div className="mx-auto w-full max-w-4xl px-3 pt-3 sm:px-4 md:pt-6">
        <Skeleton className="h-5 w-16" />
        <div className="mt-3 grid gap-6 md:grid-cols-2 md:gap-10">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
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

  const imageUrl = cake.imageUrl || DEFAULT_CAKE_IMAGE_URL;
  const addLabel = `Add · ${formatKes(unitPrice * quantity)}`;
  const addButtonClass = cn("h-12 w-full rounded-xl text-base font-semibold", !readyToAdd && "opacity-60");

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pb-10 pt-3 sm:px-4 md:pt-6">
      <button type="button" onClick={goBack} className="inline-flex items-center gap-1 rounded-lg py-2 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <div className="mt-1 grid items-start gap-6 md:grid-cols-2 md:gap-8">
        {/* Photo — tap to open full size */}
        <div>
          <div
            role="button"
            tabIndex={0}
            aria-label={`View ${cake.name} full size`}
            className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-2xl border border-border/60 bg-muted"
            onClick={() => setLightboxOpen(true)}
            onKeyDown={(e) => e.key === "Enter" && setLightboxOpen(true)}
          >
            <RevealImage src={imageUrl} alt={cake.name} className="object-cover" fallbackSrc={DEFAULT_CAKE_IMAGE_URL} placeholderClassName="bg-muted" eager timeoutMs={3000} />
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100">
              <ZoomIn className="h-3.5 w-3.5 shrink-0" />
              <span>Tap to zoom</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label="View photo"
              className="h-16 w-16 overflow-hidden rounded-xl border-2 border-foreground bg-muted"
            >
              <RevealImage src={imageUrl} alt="" className="object-cover" fallbackSrc={DEFAULT_CAKE_IMAGE_URL} placeholderClassName="bg-muted" />
            </button>
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
                src={imageUrl}
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

        {/* Details and choices */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-bold tracking-tight md:text-xl">{cake.name}</h1>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share this cake"
              className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 font-bold">{priceText}</p>

          {avgRating !== null && (
            <div className="mt-2 flex items-center gap-2">
              <StarRating rating={Math.round(avgRating)} />
              <span className="text-sm text-muted-foreground">
                {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
              </span>
            </div>
          )}

          <p ref={descriptionRef} className={cn("mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground", !descriptionExpanded && "line-clamp-3")}>
            {cake.description || "A delicious creation from Channah Cakes."}
          </p>
          {(descriptionClamped || descriptionExpanded) && (
            <button
              type="button"
              onClick={() => setDescriptionExpanded(!descriptionExpanded)}
              className="mt-1 self-start text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {descriptionExpanded ? "Show less" : "Show more"}
            </button>
          )}

          {cake.available ? (
            <>
              {!cakeOptions && (
                <div className="mt-5 space-y-3" aria-label="Loading sizes and flavours">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-10 w-2/3 rounded-xl" />
                </div>
              )}
              {hasVariants && (
                <>
                  <hr className="my-5 border-border" />
                  <OptionGroup
                    id="size-options"
                    ariaLabel="Size"
                    options={variants.map((v) => ({ value: v.label, label: v.label, price: formatKes(v.price) }))}
                    value={selectedVariant?.label ?? null}
                    onChange={setSelectedSizeLabel}
                  />
                </>
              )}

              {needsFlavour && (
                <>
                  <hr className="my-5 border-border" />
                  <OptionGroup
                    id="flavour-options"
                    label="Choose your cake flavour"
                    required
                    error={flavourError}
                    options={flavourOptions}
                    value={flavour}
                    onChange={(value) => {
                      setFlavour(value);
                      setFlavourError(null);
                    }}
                  />
                </>
              )}

              {showSecondFlavour && (
                <>
                  <hr className="my-5 border-border" />
                  <OptionGroup
                    id="second-flavour-options"
                    label="Choose your second cake flavour"
                    hint={`Optional · for cakes of ${cakeOptions?.secondFlavourMinKg} kg and above`}
                    options={flavourOptions}
                    value={secondFlavour}
                    onChange={setSecondFlavour}
                    onClear={() => setSecondFlavour(null)}
                  />
                </>
              )}

              <hr className="my-5 border-border" />
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <Label htmlFor="cake-message" className="text-sm font-bold">
                    Cake message <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <span className="text-xs text-muted-foreground">
                    {message.length}/{CAKE_MESSAGE_MAX_LENGTH}
                  </span>
                </div>
                <Input
                  id="cake-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, CAKE_MESSAGE_MAX_LENGTH))}
                  placeholder="e.g. Happy 30th Birthday, Amina"
                  maxLength={CAKE_MESSAGE_MAX_LENGTH}
                  autoComplete="off"
                  className="h-11 rounded-xl"
                />
              </div>

              <hr className="my-5 border-border" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">Quantity</span>
                <QuantityStepper
                  quantity={quantity}
                  itemName={cake.name}
                  disableDecrease={quantity <= 1}
                  onDecrease={() => setQuantity(Math.max(1, quantity - 1))}
                  onIncrease={() => setQuantity(quantity + 1)}
                />
              </div>

              {/* Desktop: inline button. Phones use the bar pinned to the bottom of the screen. */}
              <hr className="my-5 hidden border-border md:block" />
              <Button size="lg" className={cn(addButtonClass, "hidden md:flex")} onClick={handleAddToCart} data-testid="button-add-to-cart">
                {addLabel}
              </Button>
            </>
          ) : (
            <div className="mt-6 rounded-xl bg-muted px-4 py-3 text-center text-sm font-semibold text-muted-foreground">
              Currently sold out
            </div>
          )}
        </div>
      </div>

      {cake.available && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:hidden">
          <Button size="lg" className={addButtonClass} onClick={handleAddToCart}>
            {addLabel}
          </Button>
        </div>
      )}

      {relatedCakes.length > 0 && (
        <section aria-labelledby="related-title" className="mt-10">
          <h2 id="related-title" className="text-base font-bold tracking-tight">
            You may also like
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-4">
            {relatedCakes.map((related) => (
              <ProductCard key={related.id} cake={related} />
            ))}
          </div>
        </section>
      )}

      {/* ── REVIEWS ─────────────────────────────────── */}
      <div className="mt-10 border-t border-border pt-8">
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
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
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
