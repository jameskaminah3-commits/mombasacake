import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useGetCake, getGetCakeQueryKey, useListCakes } from "@workspace/api-client-react";
import { useCart } from "@/lib/cart-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Minus, Plus, ShoppingBag, ChevronLeft, Star,
  ZoomIn, X, ChevronDown, ChevronUp, ChevronRight,
  Truck, ShieldCheck, RotateCcw, Package, BadgeCheck,
  Phone,
} from "lucide-react";
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

const DELIVERY_FEATURES = [
  { icon: Truck,       text: "Same-day delivery in Mombasa & surrounds" },
  { icon: ShieldCheck, text: "Genuine products — 100% authentic brands" },
  { icon: BadgeCheck,  text: "Warranty support & after-sales service" },
  { icon: RotateCcw,   text: "Easy returns within 7 days of delivery" },
];

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
    <div className="bg-white border border-border p-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-foreground text-sm">{review.authorName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(review.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <StarRating rating={review.rating} />
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">{review.body}</p>
    </div>
  );
}

function ProductCardSmall({ product }: { product: { id: number; name: string; price: number; imageUrl?: string | null; categoryName?: string | null; variants?: Array<{ price: number }> | null } }) {
  const price = product.variants?.length
    ? Math.min(...product.variants.map((v) => v.price))
    : product.price;
  return (
    <Link href={`/cake/${product.id}`}>
      <div className="group border border-border bg-white hover:shadow-md transition-shadow cursor-pointer">
        <div className="aspect-square overflow-hidden bg-gray-50">
          <RevealImage
            src={product.imageUrl || DEFAULT_CAKE_IMAGE_URL}
            alt={product.name}
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
          />
        </div>
        <div className="p-4">
          <h4 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition-colors">{product.name}</h4>
          <p className="text-primary font-bold text-sm">KES {price.toLocaleString()}</p>
        </div>
      </div>
    </Link>
  );
}

export default function CakeDetail() {
  const { id }    = useParams();
  const cakeId    = Number(id);
  const { data: cake, isLoading } = useGetCake(cakeId, {
    query: { enabled: !!cakeId, queryKey: getGetCakeQueryKey(cakeId) },
  });
  const { data: allCakes } = useListCakes({ available: true });

  const { addItem } = useCart();
  const { toast }   = useToast();
  const [quantity,        setQuantity]        = useState(1);
  const [lightboxOpen,    setLightboxOpen]    = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{ label: string; price: number } | null>(null);
  const [specsOpen,       setSpecsOpen]       = useState(false);

  const [reviews,          setReviews]          = useState<Review[]>([]);
  const [reviewsLoading,   setReviewsLoading]   = useState(true);
  const [reviewsExpanded,  setReviewsExpanded]  = useState(false);
  const [showReviewForm,   setShowReviewForm]   = useState(false);
  const [reviewName,       setReviewName]       = useState("");
  const [reviewBody,       setReviewBody]       = useState("");
  const [reviewRating,     setReviewRating]     = useState(5);
  const [reviewOrderId,    setReviewOrderId]    = useState("");
  const [reviewPhone,      setReviewPhone]      = useState("");
  const [submitting,       setSubmitting]       = useState(false);

  useEffect(() => {
    if (!cakeId) return;
    fetch(`${getApiBaseUrl()}/api/reviews/cake/${cakeId}`)
      .then((r) => r.json())
      .then((data) => { setReviews(Array.isArray(data) ? data : []); setReviewsLoading(false); })
      .catch(() => setReviewsLoading(false));
  }, [cakeId]);

  const relatedProducts = useMemo(() => {
    if (!cake?.categoryName || !allCakes) return [];
    return allCakes
      .filter((c) => c.categoryName === cake.categoryName && c.id !== cake.id)
      .slice(0, 4);
  }, [cake, allCakes]);

  const effectivePrice = selectedVariant?.price ?? cake?.price ?? 0;
  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  const handleAddToCart = () => {
    if (!cake) return;
    if (cake.variants && cake.variants.length > 0 && !selectedVariant) {
      toast({ title: "Please choose a size", description: "Select a size before adding to cart.", variant: "destructive" });
      return;
    }
    addItem(cake, quantity, selectedVariant?.label ?? null, selectedVariant?.price ?? null);
    toast({ title: "Added to cart", description: `${quantity}× ${cake.name}${selectedVariant ? ` (${selectedVariant.label})` : ""} added.` });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setTimeout(() => window.location.assign("/checkout"), 100);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewBody.trim() || reviewRating < 1 || !reviewOrderId.trim() || !reviewPhone.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cakeId, authorName: reviewName, body: reviewBody, rating: reviewRating, orderId: Number(reviewOrderId), customerPhone: reviewPhone }),
      });
      if (!res.ok) throw new Error();
      const newReview = await res.json();
      setReviews((prev) => [newReview, ...prev]);
      setReviewName(""); setReviewBody(""); setReviewRating(5); setReviewOrderId(""); setReviewPhone("");
      setShowReviewForm(false);
      toast({ title: "Review submitted", description: "Thank you for your feedback!" });
    } catch {
      toast({ title: "Could not submit review", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="grid md:grid-cols-2 gap-12">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!cake) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Button asChild className="rounded-none"><Link href="/menu">Back to Shop</Link></Button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="container mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-muted-foreground mb-8">
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/menu" className="hover:text-primary transition-colors">Shop</Link>
          {cake.categoryName && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link href={`/menu?category=${encodeURIComponent(cake.categoryName.toLowerCase())}`} className="hover:text-primary transition-colors">
                {cake.categoryName}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground font-medium truncate max-w-[180px]">{cake.name}</span>
        </nav>

        {/* Main product grid */}
        <div className="grid md:grid-cols-2 gap-12 items-start">

          {/* Left — image */}
          <div>
            <div
              role="button"
              tabIndex={0}
              aria-label={`View ${cake.name} full size`}
              className="relative overflow-hidden border border-border bg-gray-50 cursor-zoom-in group"
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
              </div>
              <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="w-3.5 h-3.5 shrink-0" />
                Click to zoom
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
                <DialogPrimitive.Title className="sr-only">{cake.name} — full size</DialogPrimitive.Title>
                <img
                  src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                  alt={cake.name}
                  className="object-contain"
                  style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 80px)" }}
                />
                <DialogPrimitive.Close className="absolute top-4 right-4 w-10 h-10 bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors backdrop-blur-sm">
                  <X className="w-5 h-5" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          {/* Right — details */}
          <div className="flex flex-col gap-5">

            {/* Category + stock badge */}
            <div className="flex items-center justify-between">
              {cake.categoryName && (
                <Link
                  href={`/menu?category=${encodeURIComponent(cake.categoryName.toLowerCase())}`}
                  className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary hover:underline"
                >
                  {cake.categoryName}
                </Link>
              )}
              {cake.available ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  In Stock
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                  Out of Stock
                </span>
              )}
            </div>

            {/* Name */}
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground leading-tight">{cake.name}</h1>

            {/* Rating */}
            {avgRating !== null && (
              <div className="flex items-center gap-2">
                <StarRating rating={Math.round(avgRating)} />
                <span className="text-sm text-muted-foreground">
                  {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                </span>
              </div>
            )}

            {/* Price */}
            <div>
              <p className="text-3xl font-bold text-foreground">
                KES {effectivePrice.toLocaleString()}
                {selectedVariant && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">({selectedVariant.label})</span>
                )}
              </p>
              {cake.variants && cake.variants.length > 0 && !selectedVariant && (
                <p className="text-sm text-muted-foreground mt-1">
                  From KES {Math.min(...cake.variants.map((v) => v.price)).toLocaleString()}
                </p>
              )}
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-sm leading-7">
              {cake.description || "A premium product from HAPPYFINE_KE Wholesalers."}
            </p>

            {cake.available ? (
              <div className="space-y-4">
                {/* Variant selector */}
                {cake.variants && cake.variants.length > 0 && (
                  <div>
                    <p className="font-semibold text-sm mb-3 uppercase tracking-wide">Size / Variant:</p>
                    <div className="flex flex-wrap gap-2">
                      {cake.variants.map((v) => (
                        <button
                          key={v.label}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`px-4 py-2 border text-sm font-medium transition-all ${
                            selectedVariant?.label === v.label
                              ? "border-secondary bg-secondary text-white"
                              : "border-border text-foreground hover:border-secondary"
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

                {/* Quantity */}
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-sm uppercase tracking-wide">Quantity:</span>
                  <div className="flex items-center border border-border bg-white">
                    <button
                      type="button"
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors border-r border-border"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      data-testid="button-qty-minus"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-14 text-center font-semibold text-sm" data-testid="text-quantity">{quantity}</span>
                    <button
                      type="button"
                      className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors border-l border-border"
                      onClick={() => setQuantity(quantity + 1)}
                      data-testid="button-qty-plus"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* CTAs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    className="h-12 font-bold uppercase tracking-[0.1em] bg-primary hover:bg-primary/90 text-primary-foreground rounded-none"
                    onClick={handleAddToCart}
                    data-testid="button-add-to-cart"
                  >
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Add to Cart
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 font-bold uppercase tracking-[0.1em] border-2 border-secondary text-secondary hover:bg-secondary hover:text-white rounded-none transition-colors"
                    onClick={handleBuyNow}
                  >
                    Buy Now
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Total: <span className="font-semibold text-foreground">KES {(effectivePrice * quantity).toLocaleString()}</span>
                </p>
              </div>
            ) : (
              <div>
                <div className="bg-gray-50 border border-border px-6 py-4 text-center">
                  <p className="font-semibold text-muted-foreground">Currently Out of Stock</p>
                  <p className="text-sm text-muted-foreground mt-1">Contact us to be notified when available.</p>
                </div>
                <a
                  href="https://wa.me/254700000000?text=Hi!%20I%27m%20interested%20in%20a%20product%20that%27s%20out%20of%20stock."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full flex items-center justify-center gap-2 h-11 border border-border text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  Ask About Availability
                </a>
              </div>
            )}

            {/* Delivery & trust features */}
            <div className="border border-border divide-y divide-border">
              {DELIVERY_FEATURES.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 px-4 py-3">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-xs text-foreground/75">{text}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <a
              href={`https://wa.me/254700000000?text=Hi!%20I%27m%20interested%20in%20${encodeURIComponent(cake.name)}%20at%20HAPPYFINE_KE.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 h-10 border border-border text-sm font-medium text-foreground/70 hover:text-foreground hover:border-foreground transition-colors"
            >
              Ask on WhatsApp
            </a>
          </div>
        </div>

        {/* ── SPECS + DESCRIPTION ──────────────────────────── */}
        <div className="mt-16 pt-10 border-t border-border grid md:grid-cols-2 gap-8">

          {/* Product Description */}
          <div>
            <h2 className="font-serif text-2xl font-bold mb-4">Product Description</h2>
            <div className="prose prose-sm text-muted-foreground max-w-none">
              <p className="leading-7">{cake.description || "Contact us for full product details and specifications."}</p>
            </div>
          </div>

          {/* Specifications */}
          <div>
            <button
              className="w-full flex items-center justify-between py-3 border-b border-border mb-4"
              onClick={() => setSpecsOpen(!specsOpen)}
            >
              <h2 className="font-serif text-2xl font-bold">Specifications</h2>
              {specsOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </button>
            {specsOpen && (
              <div className="divide-y divide-border border border-border">
                {[
                  { label: "Brand",         value: "HAPPYFINE_KE" },
                  { label: "Category",      value: cake.categoryName ?? "General" },
                  { label: "Availability",  value: cake.available ? "In Stock" : "Out of Stock" },
                  { label: "Variants",      value: cake.variants?.length ? cake.variants.map((v) => v.label).join(", ") : "Standard" },
                  { label: "Warranty",      value: "Contact us for warranty details" },
                  { label: "Delivery",      value: "Same-day Mombasa, 1-3 days upcountry" },
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-2 text-sm">
                    <span className="px-4 py-3 font-semibold bg-gray-50 text-foreground">{label}</span>
                    <span className="px-4 py-3 text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── REVIEWS ─────────────────────────────────────── */}
        <div className="mt-16 pt-10 border-t border-border">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Customer Reviews</h2>
              {avgRating !== null && (
                <p className="text-muted-foreground text-sm mt-1">
                  {avgRating.toFixed(1)} / 5 average from {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              className="rounded-none border-border hover:border-secondary"
              onClick={() => setShowReviewForm(!showReviewForm)}
              data-testid="button-write-review"
            >
              {showReviewForm ? "Cancel" : "Write a Review"}
            </Button>
          </div>

          {showReviewForm && (
            <form onSubmit={handleSubmitReview} className="bg-gray-50 border border-border p-8 mb-8">
              <h3 className="font-serif text-xl font-bold mb-4 text-foreground">Share Your Experience</h3>
              <p className="mb-6 text-sm leading-6 text-muted-foreground">
                Reviews are only accepted after a paid purchase. Enter your order number and the phone number used at checkout to verify.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label>Your Rating</Label>
                  <StarRating rating={reviewRating} onChange={setReviewRating} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-name">Your Name</Label>
                  <Input id="review-name" value={reviewName} onChange={(e) => setReviewName(e.target.value)} placeholder="e.g. Amina S." required className="rounded-none" data-testid="input-review-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-order-id">Order Number</Label>
                  <Input id="review-order-id" value={reviewOrderId} onChange={(e) => setReviewOrderId(e.target.value)} placeholder="e.g. 123" inputMode="numeric" required className="rounded-none" data-testid="input-review-order-id" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="review-phone">Phone Used at Checkout</Label>
                  <Input id="review-phone" value={reviewPhone} onChange={(e) => setReviewPhone(e.target.value)} placeholder="e.g. 07xx xxx xxx" required className="rounded-none" data-testid="input-review-phone" />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="review-body">Your Review</Label>
                  <Textarea id="review-body" value={reviewBody} onChange={(e) => setReviewBody(e.target.value)} placeholder="Tell us about your experience..." required rows={4} className="rounded-none resize-none" data-testid="input-review-body" />
                </div>
              </div>
              <Button
                type="submit"
                disabled={submitting || !reviewName.trim() || !reviewBody.trim() || !reviewOrderId.trim() || !reviewPhone.trim()}
                className="mt-6 rounded-none px-8 bg-primary hover:bg-primary/90 text-white"
                data-testid="button-submit-review"
              >
                {submitting ? "Submitting…" : "Submit Review"}
              </Button>
            </form>
          )}

          {reviewsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border border-border text-muted-foreground">
              <Star className="w-10 h-10 mx-auto mb-3 text-border" />
              <p className="font-medium">No reviews yet</p>
              <p className="text-sm">Be the first to share your experience with {cake.name}.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {(reviewsExpanded ? reviews : reviews.slice(0, 4)).map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
              {reviews.length > 4 && (
                <button
                  type="button"
                  onClick={() => setReviewsExpanded(!reviewsExpanded)}
                  className="mt-6 flex items-center gap-2 mx-auto text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {reviewsExpanded ? <>Show less <ChevronUp className="w-4 h-4" /></> : <>Show all {reviews.length} reviews <ChevronDown className="w-4 h-4" /></>}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── RELATED PRODUCTS ─────────────────────────────── */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 pt-10 border-t border-border">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary mb-2">More From This Category</p>
                <h2 className="font-serif text-2xl font-bold text-foreground">You May Also Like</h2>
              </div>
              <Link href={`/menu?category=${encodeURIComponent((cake.categoryName ?? "").toLowerCase())}`} className="flex items-center gap-1 text-primary text-sm font-semibold hover:underline">
                View all <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {relatedProducts.map((p) => (
                <ProductCardSmall key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
