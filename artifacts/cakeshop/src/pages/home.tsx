import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetFeaturedCakes, useGetPopularCakes, useListCakes, useListPromotions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_GALLERY_IMAGE_URL } from "@/lib/site-images";
import { buildSupabaseMediaUrl } from "@/lib/supabase-media";
import { DEFAULT_HOMEPAGE_GALLERY, fetchHomepageGallery } from "@/lib/homepage-gallery";
import { DEFAULT_HOMEPAGE_HERO, fetchHomepageHero } from "@/lib/homepage-hero";
import {
  Star, Truck, ShieldCheck, BadgePercent, Headphones,
  ChevronRight, UtensilsCrossed, Microwave, Dumbbell,
  Sparkles, BedDouble, Sofa,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-base";
import { RevealImage } from "@/components/reveal-image";

/* ─── types ─── */
type ProductReview = {
  id: number;
  cakeId: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
  cakeName: string;
};

type DisplayProductCard = {
  id: number | string;
  name: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string | null;
  featured?: boolean;
  description?: string | null;
};

/* ─── constants ─── */
const PROMISES = [
  { icon: Truck,        title: "Fast Delivery",      desc: "Mombasa & surrounds, same-day available." },
  { icon: ShieldCheck,  title: "Genuine Products",   desc: "100% authentic brands, verified stock." },
  { icon: BadgePercent, title: "Wholesale Pricing",  desc: "Factory-direct deals on every item." },
  { icon: Headphones,   title: "Support 7 Days",     desc: "Call or WhatsApp us any day, 8am–7pm." },
];

const CATEGORIES = [
  { icon: UtensilsCrossed, label: "Kitchen & Utensils",  href: "/menu?category=kitchen",       bg: "bg-secondary" },
  { icon: Microwave,        label: "Home Appliances",     href: "/menu?category=appliances",    bg: "bg-foreground" },
  { icon: Dumbbell,         label: "Gym & Fitness",       href: "/menu?category=gym",           bg: "bg-secondary" },
  { icon: Sparkles,         label: "Personal Care",       href: "/menu?category=personal-care", bg: "bg-foreground" },
  { icon: BedDouble,        label: "Bedroom",             href: "/menu?category=bedroom",       bg: "bg-secondary" },
  { icon: Sofa,             label: "Living Room",         href: "/menu?category=living-room",   bg: "bg-foreground" },
];

const TESTIMONIALS = [
  {
    name: "Amina S.", location: "Mombasa", rating: 5,
    text: "The blender I ordered arrived the same day and works perfectly. HAPPYFINE_KE has become my go-to for all kitchen appliances.",
  },
  {
    name: "Brian K.", location: "Nyali", rating: 5,
    text: "Got a washing machine at an unbelievably fair price. Delivery was smooth and the team was professional throughout.",
  },
  {
    name: "Fatuma A.", location: "Bamburi", rating: 5,
    text: "The gym equipment is top quality. I've ordered three times and each time the service has been excellent.",
  },
];

const HERO_ROTATION_MS = 4000;

type HeroSlide = {
  src: string;
  previewSrc: string;
  title: string;
  label: string;
  accent: string;
};

function toHeroSlides(slides: typeof DEFAULT_HOMEPAGE_HERO.slides): HeroSlide[] {
  return slides.map((s) => ({
    src: s.imageUrl, previewSrc: s.imageUrl,
    title: s.title, label: s.label, accent: s.accent,
  }));
}

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/* ─── sub-components ─── */
function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden border border-border bg-card">
      <Skeleton className="aspect-square w-full" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "fill-primary text-primary" : "text-border"}`} />
      ))}
    </div>
  );
}

function HeroCarouselImage({ slides, activeIndex }: { slides: HeroSlide[]; activeIndex: number }) {
  useEffect(() => {
    slides.forEach((s) => { void preloadImage(s.src); void preloadImage(s.previewSrc); });
  }, [slides]);
  const slide = slides.length > 0 ? slides[activeIndex % slides.length] : undefined;
  if (!slide) return null;
  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.img
        key={slide.src}
        src={slide.src}
        srcSet={`${slide.previewSrc} 560w, ${slide.src} 1200w`}
        sizes="100vw"
        alt={slide.title}
        className="absolute inset-0 h-full w-full select-none object-cover pointer-events-none"
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1.08 }}
        exit={{ opacity: 0 }}
        transition={{ opacity: { duration: 0.5, ease: "easeOut" }, scale: { duration: 20, ease: "easeInOut" } }}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </AnimatePresence>
  );
}

function ProductCard({ product, href, size = "default" }: { product: DisplayProductCard; href: string; size?: "default" | "sm" }) {
  return (
    <Link href={href}>
      <div className="group overflow-hidden border border-border bg-card transition-shadow hover:shadow-md cursor-pointer">
        <div className={`overflow-hidden bg-muted relative ${size === "sm" ? "aspect-square" : "aspect-[4/5]"}`}>
          <RevealImage
            src={product.imageUrl || DEFAULT_GALLERY_IMAGE_URL}
            alt={product.name}
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            eager
            fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
          />
          {product.categoryName && (
            <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
              {product.categoryName}
            </span>
          )}
          {product.featured && (
            <span className="absolute top-3 right-3 bg-primary text-primary-foreground px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]">
              Featured
            </span>
          )}
        </div>
        <div className={`${size === "sm" ? "p-3" : "p-5"}`}>
          <h3 className={`font-semibold text-foreground group-hover:text-primary transition-colors truncate ${size === "sm" ? "text-sm mb-1" : "text-base mb-1.5"}`}>
            {product.name}
          </h3>
          <p className={`font-bold text-primary ${size === "sm" ? "text-sm" : "text-base"}`}>
            {product.price > 0 ? `KES ${product.price.toLocaleString()}` : "View product"}
          </p>
        </div>
      </div>
    </Link>
  );
}

const galleryImage = (file: string) => buildSupabaseMediaUrl(`gallery/${file}`);
const formatMoney = (v: number) => `KES ${v.toLocaleString()}`;
const humanizeSlug = (v: string) => v.replace(/-/g, " ");

/* ─── page ─── */
export default function Home() {
  const { data: featuredCakes,  isLoading: loadingFeatured }  = useGetFeaturedCakes();
  const { data: popularCakes,   isLoading: loadingPopular }   = useGetPopularCakes();
  const { data: listedCakes }                                   = useListCakes({ available: true });
  const { data: promotions }                                    = useListPromotions();
  const { data: homepageHero }  = useQuery({
    queryKey: ["homepage-hero"],
    queryFn:  fetchHomepageHero,
    placeholderData: DEFAULT_HOMEPAGE_HERO,
  });
  const { data: homepageGallery } = useQuery({
    queryKey: ["homepage-gallery"],
    queryFn:  fetchHomepageGallery,
    placeholderData: DEFAULT_HOMEPAGE_GALLERY,
  });

  const [activeHeroIndex,   setActiveHeroIndex]   = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [liveReviews,       setLiveReviews]       = useState<ProductReview[]>([]);
  const [reviewsLoading,    setReviewsLoading]    = useState(true);

  const cakeNameBySlug = new Map((listedCakes ?? []).map((c) => [c.slug, c.name]));
  const now = Date.now();
  const activePromotions = (promotions ?? []).filter((p) => {
    if (!p.active || p.showInStrip === false) return false;
    if (p.startsAt && new Date(p.startsAt).getTime() > now) return false;
    if (p.endsAt   && new Date(p.endsAt).getTime()   < now) return false;
    return true;
  });

  const heroSlides = toHeroSlides(homepageHero?.slides ?? DEFAULT_HOMEPAGE_HERO.slides);
  const activeHero = heroSlides[activeHeroIndex % heroSlides.length];

  const featuredCards: DisplayProductCard[] =
    featuredCakes?.slice(0, 3)?.length
      ? featuredCakes.slice(0, 3)
      : heroSlides.slice(0, 3).map((s, i) => ({
          id: `ff-${i}`, name: s.title, price: 0,
          imageUrl: s.src, categoryName: s.label, description: s.accent,
        }));

  const popularCards: DisplayProductCard[] =
    popularCakes?.slice(0, 4)?.length
      ? popularCakes.slice(0, 4)
      : [...heroSlides, ...heroSlides].slice(0, 4).map((s, i) => ({
          id: `pf-${i}`, name: s.title, price: 0,
          imageUrl: s.src, categoryName: s.label,
        }));

  const galleryItems = homepageGallery?.items ?? DEFAULT_HOMEPAGE_GALLERY.items;
  const gallerySplit = Math.ceil(galleryItems.length / 2);
  const galleryRows  = [galleryItems.slice(0, gallerySplit), galleryItems.slice(gallerySplit)];

  useEffect(() => {
    const srcs = Array.from(new Set([
      ...heroSlides.flatMap((s) => [s.src, s.previewSrc]),
      ...galleryItems.map((g) => g.imageUrl),
    ]));
    const t = window.setTimeout(() => srcs.forEach((s) => void preloadImage(s)), 0);
    return () => window.clearTimeout(t);
  }, [heroSlides, galleryItems]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const t = window.setInterval(() => setActiveHeroIndex((i) => (i + 1) % heroSlides.length), HERO_ROTATION_MS);
    return () => window.clearInterval(t);
  }, [heroSlides.length]);

  useEffect(() => { setActiveHeroIndex(0); }, [heroSlides.length]);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    (async () => {
      setReviewsLoading(true);
      try {
        const res  = await fetch(`${getApiBaseUrl()}/api/reviews`, { signal: ctrl.signal });
        const data = (await res.json()) as ProductReview[];
        if (!cancelled) {
          setLiveReviews(data.sort((a, b) => b.rating - a.rating || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }
      } catch { if (!cancelled) setLiveReviews([]); }
      finally  { if (!cancelled) setReviewsLoading(false); }
    })();
    return () => { cancelled = true; ctrl.abort(); };
  }, []);

  const highestRating     = liveReviews[0]?.rating ?? 0;
  const featuredReviews   = liveReviews.filter((r) => r.rating === highestRating);
  const highlightedReview = featuredReviews.length > 0
    ? featuredReviews[activeReviewIndex % featuredReviews.length]
    : liveReviews[activeReviewIndex % liveReviews.length] ?? null;
  const rotatingReviews   = liveReviews.filter((r) => r.id !== highlightedReview?.id);
  const secondaryReviews  = rotatingReviews.length > 0
    ? [rotatingReviews[activeReviewIndex % rotatingReviews.length], rotatingReviews[(activeReviewIndex + 1) % rotatingReviews.length]]
        .filter(Boolean).slice(0, 2)
    : [];
  const averageRating = liveReviews.length > 0
    ? liveReviews.reduce((s, r) => s + r.rating, 0) / liveReviews.length : 0;

  useEffect(() => {
    if (liveReviews.length <= 1) return;
    const t = window.setInterval(() => setActiveReviewIndex((i) => (i + 1) % liveReviews.length), 6500);
    return () => window.clearInterval(t);
  }, [liveReviews.length]);

  return (
    <div className="flex flex-col w-full">

      {/* ── PROMOTIONS TICKER ─────────────────────────────── */}
      {activePromotions.length > 0 && (
        <section className="overflow-hidden bg-foreground py-3 text-white">
          <div className="promo-marquee">
            <div className="promo-marquee-track">
              {[...activePromotions, ...activePromotions].map((promo, i) => (
                <div key={`${promo.id}-${i}`} className="flex shrink-0 items-center gap-4 whitespace-nowrap">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">DEAL</span>
                  <span className="text-sm">{describePromotion(promo, cakeNameBySlug)}</span>
                  <span className="text-white/30">·</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="relative h-[calc(100svh-108px)] min-h-[500px] max-h-[820px] w-full overflow-hidden bg-secondary text-white">
        <HeroCarouselImage slides={heroSlides} activeIndex={activeHeroIndex} />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(14,30,18,0.92)_0%,rgba(14,30,18,0.55)_50%,rgba(14,30,18,0.18)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(14,30,18,0.75)_0%,transparent_45%)]" />

        <div className="relative z-10 container mx-auto flex h-full items-center px-4 py-12">
          <motion.div
            className="max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
          >
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.32em] text-primary">
              HAPPYFINE_KE · Soft Life Ambassador
            </p>
            <h1 className="mb-6 font-serif text-[clamp(2.8rem,8vw,6.5rem)] font-bold leading-[0.9] drop-shadow-lg">
              Live the<br />Soft Life
            </h1>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeHero?.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="mb-8 max-w-lg"
              >
                <p className="font-serif text-xl leading-snug text-white/90 sm:text-2xl">{activeHero?.title}</p>
                <p className="mt-3 text-sm leading-7 text-white/70 sm:text-base sm:leading-relaxed">
                  {activeHero?.accent}.
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mb-8 flex items-center gap-2">
              {heroSlides.map((_, i) => (
                <button
                  key={i} type="button"
                  onClick={() => setActiveHeroIndex(i)}
                  className={`h-[3px] transition-all duration-300 ${i === activeHeroIndex ? "w-8 bg-primary" : "w-3 bg-white/35 hover:bg-white/60"}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="h-12 px-8 text-sm font-bold uppercase tracking-[0.12em] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-black/30 rounded-none" asChild>
                <Link href="/menu">Shop Now</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-8 text-sm font-semibold uppercase tracking-[0.12em] border-white/30 bg-white/8 text-white backdrop-blur-sm hover:bg-white/15 rounded-none" asChild>
                <Link href="/menu">Browse Categories</Link>
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-6 right-4 z-10 hidden items-end gap-2.5 sm:flex">
          {heroSlides.map((slide, i) => (
            <button
              key={slide.src} type="button"
              onClick={() => setActiveHeroIndex(i)}
              className={`relative h-[72px] w-[52px] overflow-hidden border transition-all duration-300 ${
                i === activeHeroIndex ? "border-primary opacity-100 shadow-xl" : "border-white/20 opacity-50 hover:opacity-80"
              }`}
              aria-label={`View slide ${i + 1}`}
            >
              <RevealImage src={slide.previewSrc} alt="" className="object-cover" eager />
            </button>
          ))}
        </div>
      </section>

      {/* ── SHOP BY CATEGORY ──────────────────────────────── */}
      <section className="py-16 sm:py-20 container mx-auto px-4">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="uppercase tracking-[0.22em] text-[10px] text-primary font-bold mb-3">Browse</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">Shop by Category</h2>
          </div>
          <Link href="/menu" className="flex items-center gap-1 text-primary font-semibold text-sm hover:underline">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map(({ icon: Icon, label, href, bg }) => (
            <Link key={href} href={href}>
              <div className={`group ${bg} text-white flex flex-col items-center justify-center gap-3 py-8 px-4 transition-opacity hover:opacity-90 cursor-pointer`}>
                <Icon className="w-7 h-7 text-primary" />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-center leading-tight">{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ─────────────────────────────── */}
      <section className="bg-muted py-16 sm:py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="uppercase tracking-[0.22em] text-[10px] text-primary font-bold mb-3">Handpicked</p>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">Featured Products</h2>
            </div>
            <Link href="/menu" className="flex items-center gap-1 text-primary font-semibold text-sm hover:underline">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          {loadingFeatured ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {featuredCards.map((p) => (
                <ProductCard key={p.id} product={p} href={typeof p.id === "number" ? `/cake/${p.id}` : "/menu"} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── PROMISES STRIP ────────────────────────────────── */}
      <section className="bg-foreground text-white py-12 sm:py-14">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {PROMISES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 shrink-0 flex items-center justify-center border border-primary/40 bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-[0.12em] mb-1">{title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROMOTIONAL BANNER ────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[320px] flex items-center">
        <div className="absolute inset-0">
          <RevealImage
            src={galleryImage("cake-heels.jpeg")}
            alt=""
            className="object-cover opacity-20"
            eager
            fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
          />
        </div>
        <div className="absolute inset-0 bg-secondary" style={{ opacity: 0.92 }} />
        <div className="relative z-10 container mx-auto px-4 py-16 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary mb-4">Limited Time</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
              Wholesale Prices.<br />Premium Quality.
            </h2>
            <p className="text-white/65 text-base leading-relaxed max-w-md">
              Shop our full catalog of home appliances, kitchen essentials, gym gear, and personal care products — all at unbeatable wholesale prices.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-4 md:justify-end">
            <Button size="lg" className="h-12 px-8 text-sm font-bold uppercase tracking-[0.12em] bg-primary text-primary-foreground hover:bg-primary/90 rounded-none" asChild>
              <Link href="/menu">Shop All Products</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-sm font-semibold uppercase tracking-[0.12em] border-white/30 text-white hover:bg-white/10 rounded-none" asChild>
              <Link href="/menu?deals=true">View Deals</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── BESTSELLERS ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 md:py-24 container mx-auto px-4">
        <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="uppercase tracking-[0.22em] text-[10px] text-primary font-bold mb-3">Top Picks</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">Bestsellers</h2>
          </div>
          <Link href="/menu" className="flex items-center gap-1 text-primary font-semibold text-sm hover:underline">
            See all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {loadingPopular ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {popularCards.map((p) => (
              <ProductCard key={p.id} product={p} href={typeof p.id === "number" ? `/cake/${p.id}` : "/menu"} size="sm" />
            ))}
          </div>
        )}
      </section>

      {/* ── SCROLLING GALLERY ─────────────────────────────── */}
      <section className="overflow-hidden bg-foreground py-12 sm:py-16">
        <div className="container mx-auto px-4 mb-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary mb-3">In Stock</p>
          <h2 className="font-serif text-3xl font-bold text-white sm:text-4xl">Our Collection</h2>
          <p className="mt-3 text-sm text-white/50 max-w-md mx-auto">From kitchen to bedroom — everything you need for the soft life, in one place.</p>
        </div>
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {galleryRows.map((row, rowIdx) => (
            <div key={rowIdx} className="work-rail">
              <div className={`work-rail-track ${rowIdx === 1 ? "work-rail-reverse" : ""}`}>
                {[...row, ...row].map(({ imageUrl, label }, i) => (
                  <figure key={`${imageUrl}-${i}`} className="group relative h-52 w-[58vw] max-w-[240px] shrink-0 overflow-hidden border border-white/8 bg-white/5">
                    <RevealImage src={imageUrl} alt={label} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" fallbackSrc={DEFAULT_GALLERY_IMAGE_URL} timeoutMs={7000} />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.7)_100%)]" />
                    <figcaption className="absolute bottom-0 left-0 right-0 p-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">{label}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
        <div className="text-center mt-10">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-none px-10 h-12 font-bold text-sm uppercase tracking-[0.12em]" asChild>
            <Link href="/menu">Explore All Products</Link>
          </Button>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────── */}
      <section className="py-14 sm:py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="overflow-hidden border border-border bg-foreground text-white shadow-2xl shadow-black/20">
            <div className="grid lg:grid-cols-[1.3fr_0.7fr]">
              <div className="relative min-h-[360px] p-8 sm:p-12 lg:p-14">
                <div className="absolute inset-0 bg-[linear-gradient(100deg,rgba(14,30,18,0.98),rgba(14,30,18,0.72))]" />
                <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                  <div>
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Customer Reviews</p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div key={`rating-${highlightedReview?.id ?? "empty"}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        <StarRating rating={highlightedReview?.rating || 0} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <blockquote className="max-w-2xl">
                    {reviewsLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-7 w-2/3 bg-white/10" />
                        <Skeleton className="h-7 w-full bg-white/10" />
                        <Skeleton className="h-7 w-1/2 bg-white/10" />
                      </div>
                    ) : highlightedReview ? (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={highlightedReview.id} initial={{ opacity: 0, y: 16, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.5, ease: "easeOut" }}>
                          <p className="font-serif text-3xl leading-tight sm:text-4xl">"{highlightedReview.body}"</p>
                          <footer className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">{highlightedReview.authorName} · {highlightedReview.cakeName}</footer>
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <>
                        <p className="font-serif text-3xl leading-tight">"Customer reviews will appear here."</p>
                        <footer className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">Live reviews</footer>
                      </>
                    )}
                  </blockquote>
                </div>
              </div>
              <div className="border-t border-white/10 bg-white/[0.03] p-6 sm:p-8 lg:border-l lg:border-t-0">
                <div className="mb-6 grid grid-cols-2 gap-3">
                  <div className="border border-white/10 p-4">
                    <p className="font-serif text-3xl font-bold text-primary">{averageRating ? averageRating.toFixed(1) : "0.0"}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">Avg. rating</p>
                  </div>
                  <div className="border border-white/10 p-4">
                    <p className="font-serif text-3xl font-bold text-primary">{liveReviews.length}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-widest text-white/45">Reviews</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {reviewsLoading ? (
                    <><Skeleton className="h-24 w-full bg-white/10" /><Skeleton className="h-24 w-full bg-white/10" /></>
                  ) : secondaryReviews.length > 0 ? (
                    <AnimatePresence mode="popLayout" initial={false}>
                      {secondaryReviews.map((r, i) => (
                        <motion.blockquote key={r.id} layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.04 }} className="border border-white/10 bg-white/[0.04] p-4">
                          <StarRating rating={r.rating} />
                          <p className="mt-3 text-sm leading-6 text-white/70">"{r.body}"</p>
                          <footer className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{r.authorName}</footer>
                        </motion.blockquote>
                      ))}
                    </AnimatePresence>
                  ) : (
                    <div className="border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-sm text-white/55">Reviews from your customers will appear here.</p>
                    </div>
                  )}
                </div>
                {liveReviews.length === 0 && !reviewsLoading && (
                  <div className="mt-4 space-y-3">
                    {TESTIMONIALS.map((t) => (
                      <div key={t.name} className="border border-white/10 bg-white/[0.04] p-4">
                        <StarRating rating={t.rating} />
                        <p className="mt-3 text-sm leading-6 text-white/70">"{t.text}"</p>
                        <footer className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{t.name} · {t.location}</footer>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section className="bg-primary py-14 sm:py-16 text-center">
        <div className="container mx-auto px-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary-foreground/70 mb-4">Ready to upgrade?</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-primary-foreground mb-4 leading-tight">
            Your Soft Life Starts Here
          </h2>
          <p className="text-primary-foreground/75 text-base md:text-lg mb-8 max-w-lg mx-auto">
            Explore hundreds of home products, appliances, and lifestyle essentials — delivered fresh to your door in Mombasa.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-12 px-10 text-sm font-bold uppercase tracking-[0.12em] bg-primary-foreground text-primary hover:bg-primary-foreground/90 rounded-none shadow-lg" asChild>
              <Link href="/menu">Shop All Products</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-10 text-sm font-semibold uppercase tracking-[0.12em] border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 rounded-none" asChild>
              <Link href="/blog">Read Our Blog</Link>
            </Button>
          </div>
        </div>
      </section>

      <style>{`
        .work-rail {
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          overflow: hidden;
        }
        .work-rail-track {
          display: flex;
          width: max-content;
          gap: 0.75rem;
          padding-inline: 0.75rem;
          animation: workRail 44s linear infinite;
        }
        .work-rail-reverse {
          animation-direction: reverse;
          animation-duration: 50s;
        }
        .work-rail:hover .work-rail-track {
          animation-play-state: paused;
        }
        .promo-marquee { overflow: hidden; }
        .promo-marquee-track {
          display: flex;
          width: max-content;
          gap: 3rem;
          padding-inline: 1.5rem;
          animation: promoFlow 30s linear infinite;
        }
        @keyframes workRail {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes promoFlow {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .work-rail { overflow-x: auto; scrollbar-width: none; }
          .work-rail::-webkit-scrollbar { display: none; }
          .work-rail-track, .promo-marquee-track { animation: none; }
        }
      `}</style>
    </div>
  );
}

function describePromotion(
  promo: {
    code?: string | null; title: string; description?: string | null;
    discountPct?: number | null; discountAmount?: number | null;
    minimumOrderAmount?: number | null; applicableCakeSlugs?: string[] | null;
  },
  cakeNameBySlug: Map<string, string>,
) {
  if (promo.description && !promo.code && !promo.discountPct && !promo.discountAmount && !promo.minimumOrderAmount && !promo.applicableCakeSlugs?.length) {
    return promo.description;
  }
  const discountText = promo.discountAmount != null
    ? formatMoney(promo.discountAmount)
    : promo.discountPct != null ? `${promo.discountPct}% off` : "a special offer";
  const scopeText = (() => {
    if (promo.applicableCakeSlugs?.length) {
      return `on ${promo.applicableCakeSlugs.map((s) => cakeNameBySlug.get(s) ?? humanizeSlug(s)).join(", ")}`;
    }
    return promo.minimumOrderAmount != null ? `on orders of ${formatMoney(promo.minimumOrderAmount)}+` : "on your order";
  })();
  if (promo.code) return `Use code ${promo.code} to get ${discountText} ${scopeText}.`;
  if (promo.description) return promo.description;
  return `Get ${discountText} ${scopeText}.`;
}
