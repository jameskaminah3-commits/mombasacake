import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetFeaturedCakes, useGetPopularCakes, useListCakes, useListPromotions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_GALLERY_IMAGE_URL } from "@/lib/site-images";
import { buildSupabaseMediaUrl } from "@/lib/supabase-media";
import { DEFAULT_HOMEPAGE_GALLERY, fetchHomepageGallery } from "@/lib/homepage-gallery";
import { DEFAULT_HOMEPAGE_HERO, fetchHomepageHero } from "@/lib/homepage-hero";
import { Star, Truck, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getApiBaseUrl } from "@/lib/api-base";
import { RevealImage } from "@/components/reveal-image";

function CakeCardSkeleton() {
  return (
    <Card className="overflow-hidden border-none shadow-sm rounded-xl">
      <Skeleton className="h-[300px] w-full" />
      <CardContent className="p-4">
        <Skeleton className="h-6 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/3" />
      </CardContent>
    </Card>
  );
}

function formatMoney(value: number) {
  return `KES ${value.toLocaleString()}`;
}

function humanizeSlug(value: string) {
  return value.replace(/-/g, " ");
}

type CakeReview = {
  id: number;
  cakeId: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
  cakeName: string;
};

type DisplayCakeCard = {
  id: number | string;
  name: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string | null;
  featured?: boolean;
  description?: string | null;
};

const WHY_US = [
  { icon: Star, title: "Artisan Finish", desc: "Handcrafted to order." },
  { icon: Truck, title: "Mombasa Delivery", desc: "Fresh across the county." },
  { icon: Clock, title: "Event Ready", desc: "Custom orders in 48 hours." },
  { icon: ShieldCheck, title: "Secure MPesa Checkout", desc: "Pay Safely and Instantly." },
];

const TESTIMONIALS = [
  {
    name: "Amina S.",
    location: "Mombasa",
    rating: 5,
    text: "The custom birthday cake was absolutely extraordinary. Our guests could not stop talking about it — the detail was incredible!",
  },
  {
    name: "Brian K.",
    location: "Nyali",
    rating: 5,
    text: "The wedding cake looked elegant from every angle and tasted even better.",
  },
  {
    name: "Fatuma A.",
    location: "Bamburi",
    rating: 5,
    text: "Premium packaging, prompt delivery, and a butterfly cake that felt truly special.",
  },
];

const landingImage = (variant: "hero" | "work", file: string) =>
  buildSupabaseMediaUrl(`gallery/landing/${variant}-${file}`);
const galleryImage = (file: string) => buildSupabaseMediaUrl(`gallery/${file}`);

const HERO_ROTATION_MS = 3000;
const HERO_CROSSFADE_MS = 420;

type HeroCarouselSlide = {
  src: string;
  previewSrc: string;
  title: string;
  label: string;
  accent: string;
};

function toHeroCarouselSlides(slides: typeof DEFAULT_HOMEPAGE_HERO.slides): HeroCarouselSlide[] {
  return slides.map((slide) => ({
    src: slide.imageUrl,
    previewSrc: slide.imageUrl,
    title: slide.title,
    label: slide.label,
    accent: slide.accent,
  }));
}

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

function HeroCarouselImage({
  slides,
  activeIndex,
}: {
  slides: HeroCarouselSlide[];
  activeIndex: number;
}) {
  useEffect(() => {
    slides.forEach((slide) => {
      void preloadImage(slide.src);
      void preloadImage(slide.previewSrc);
    });
  }, [slides]);
  const visibleSlide = slides.length > 0 ? slides[activeIndex % slides.length] : undefined;

  if (!visibleSlide) {
    return null;
  }

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.img
        key={visibleSlide.src}
        src={visibleSlide.src}
        srcSet={`${visibleSlide.previewSrc} 560w, ${visibleSlide.src} 1200w`}
        sizes="100vw"
        alt={visibleSlide.title}
        className="absolute inset-0 h-full w-full select-none object-cover pointer-events-none"
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1.1 }}
        exit={{ opacity: 0 }}
        transition={{
          opacity: { duration: 0.45, ease: "easeOut" },
          scale: { duration: 18, ease: "easeInOut" },
        }}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </AnimatePresence>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${i < rating ? "fill-primary text-primary" : "text-border"}`}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const { data: featuredCakes, isLoading: loadingFeatured } = useGetFeaturedCakes();
  const { data: popularCakes, isLoading: loadingPopular } = useGetPopularCakes();
  const { data: listedCakes } = useListCakes({ available: true });
  const { data: promotions } = useListPromotions();
  const { data: homepageHero } = useQuery({
    queryKey: ["homepage-hero"],
    queryFn: fetchHomepageHero,
    placeholderData: DEFAULT_HOMEPAGE_HERO,
  });
  const { data: homepageGallery } = useQuery({
    queryKey: ["homepage-gallery"],
    queryFn: fetchHomepageGallery,
    placeholderData: DEFAULT_HOMEPAGE_GALLERY,
  });
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [liveReviews, setLiveReviews] = useState<CakeReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const cakeNameBySlug = new Map((listedCakes ?? []).map((cake) => [cake.slug, cake.name]));

  const now = Date.now();
  const activePromotions = promotions?.filter((p) => {
    if (!p.active) return false;
    if (p.showInStrip === false) return false;
    if (p.startsAt && new Date(p.startsAt).getTime() > now) return false;
    if (p.endsAt && new Date(p.endsAt).getTime() < now) return false;
    return true;
  }) || [];

  const heroSlides = toHeroCarouselSlides(homepageHero?.slides ?? DEFAULT_HOMEPAGE_HERO.slides);
  const activeHero = heroSlides[activeHeroIndex % heroSlides.length];
  const featuredCards: DisplayCakeCard[] =
    featuredCakes?.slice(0, 3)?.length
      ? featuredCakes.slice(0, 3)
      : heroSlides.slice(0, 3).map((cake, index) => ({
          id: `featured-fallback-${index}`,
          name: cake.title,
          price: 0,
          imageUrl: cake.src,
          categoryName: cake.label,
          featured: false,
          description: cake.accent,
        }));
  const popularCards: DisplayCakeCard[] =
    popularCakes?.slice(0, 4)?.length
      ? popularCakes.slice(0, 4)
      : [...heroSlides, ...heroSlides].slice(0, 4).map((cake, index) => ({
          id: `popular-fallback-${index}`,
          name: cake.title,
          price: 0,
          imageUrl: cake.src,
          categoryName: cake.label,
          featured: false,
          description: cake.accent,
        }));

  const galleryItems = homepageGallery?.items ?? DEFAULT_HOMEPAGE_GALLERY.items;
  const gallerySplit = Math.ceil(galleryItems.length / 2);
  const galleryRows = [galleryItems.slice(0, gallerySplit), galleryItems.slice(gallerySplit)];

  useEffect(() => {
    const warmSources = Array.from(
      new Set([
        ...heroSlides.flatMap((cake) => [cake.src, cake.previewSrc]),
        ...galleryItems.map((item) => item.imageUrl),
        landingImage("hero", "cake-heart.jpeg"),
        landingImage("hero", "cake-heels.jpeg"),
        galleryImage("cake-heart.jpeg"),
        galleryImage("cake-heels.jpeg"),
        DEFAULT_GALLERY_IMAGE_URL,
      ]),
    );

    const timer = window.setTimeout(() => {
      warmSources.forEach((src) => {
        void preloadImage(src);
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [heroSlides, galleryItems]);

  useEffect(() => {
    if (heroSlides.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % heroSlides.length);
    }, HERO_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    setActiveHeroIndex(0);
  }, [heroSlides.length]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadReviews() {
      setReviewsLoading(true);
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/reviews`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Failed to load reviews");
        }
        const reviews = (await response.json()) as CakeReview[];
        if (!cancelled) {
          const flattened = reviews.sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          setLiveReviews(flattened);
        }
      } catch {
        if (!cancelled) {
          setLiveReviews([]);
        }
      } finally {
        if (!cancelled) {
          setReviewsLoading(false);
        }
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const highestRating = liveReviews[0]?.rating ?? 0;
  const featuredReviews = liveReviews.filter((review) => review.rating === highestRating);
  const highlightedReview = featuredReviews.length > 0
    ? featuredReviews[activeReviewIndex % featuredReviews.length]
    : liveReviews[activeReviewIndex % liveReviews.length] ?? null;
  const rotatingReviews = liveReviews.filter((review) => review.id !== highlightedReview?.id);
  const secondaryReviews = rotatingReviews.length > 0
    ? [
        rotatingReviews[activeReviewIndex % rotatingReviews.length],
        rotatingReviews[(activeReviewIndex + 1) % rotatingReviews.length],
      ].filter(Boolean).slice(0, 2)
    : [];
  const averageRating = liveReviews.length > 0
    ? liveReviews.reduce((sum, review) => sum + review.rating, 0) / liveReviews.length
    : 0;

  useEffect(() => {
    if (liveReviews.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveReviewIndex((current) => (current + 1) % liveReviews.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, [liveReviews.length]);

  return (
    <div className="flex flex-col w-full">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative h-[calc(100svh-112px)] min-h-[480px] max-h-[780px] w-full overflow-hidden bg-[#170c10] text-white sm:min-h-[620px]">
        <HeroCarouselImage slides={heroSlides} activeIndex={activeHeroIndex} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,12,16,0.88)_0%,rgba(23,12,16,0.58)_46%,rgba(23,12,16,0.2)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(23,12,16,0.72)_0%,rgba(23,12,16,0.1)_42%,rgba(23,12,16,0.34)_100%)]" />

        <div className="relative z-10 container mx-auto flex h-full items-center px-4 py-10 sm:py-12">
          <motion.div
            className="max-w-3xl pr-3 sm:pr-0"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70 sm:text-xs">
              Channah Cake House
            </p>
            <h1 className="mb-5 max-w-[10ch] font-serif text-[clamp(3.2rem,9vw,7.8rem)] font-bold leading-[0.92] drop-shadow-md sm:max-w-[11ch]">
              Decadence in Every Bite
            </h1>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeHero.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="mb-7 max-w-xl"
              >
                <p className="font-serif text-2xl leading-tight text-white sm:text-3xl">
                  {activeHero.title}
                </p>
                <p className="mt-3 max-w-[21.5rem] text-sm leading-7 text-white/80 sm:max-w-[30rem] sm:text-lg sm:leading-relaxed">
                  {activeHero.accent}.
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="mb-8 flex flex-wrap items-center gap-2">
              {heroSlides.map((cake, index) => (
                <button
                  key={cake.src}
                  type="button"
                  onClick={() => setActiveHeroIndex(index)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    index === activeHeroIndex ? "w-10 bg-primary" : "w-2.5 bg-white/45 hover:bg-white/75"
                  }`}
                  aria-label={`Show ${cake.label}`}
                  aria-pressed={index === activeHeroIndex}
                />
              ))}
              <span className="ml-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                {activeHero.label}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                size="lg"
                className="h-12 rounded-full bg-primary px-8 text-base font-semibold text-white shadow-lg shadow-black/30 hover:bg-primary/90 sm:h-14 sm:px-10"
                asChild
              >
                <Link href="/menu">Order Now</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-white/35 bg-white/10 px-8 text-base text-white backdrop-blur-sm hover:bg-white/20 sm:h-14 sm:px-10"
                asChild
              >
                <Link href="/menu">Explore Menu</Link>
              </Button>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-5 right-4 z-10 hidden items-end gap-3 sm:flex">
          {heroSlides.map((cake, index) => (
            <button
              key={cake.src}
              type="button"
              onClick={() => setActiveHeroIndex(index)}
              className={`group relative h-20 w-16 overflow-hidden rounded-lg border transition-all duration-300 ${
                index === activeHeroIndex ? "border-white/80 opacity-100 shadow-xl" : "border-white/20 opacity-60 hover:opacity-90"
              }`}
              aria-label={`Preview ${cake.label}`}
            >
              <RevealImage
                src={cake.previewSrc}
                alt=""
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                eager
              />
            </button>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/20" />
      </section>

      {/* ── PROMOTIONS TICKER ───────────────────────────── */}
      {activePromotions.length > 0 && (
        <section className="overflow-hidden bg-primary py-4 text-white">
          <div className="promo-marquee">
            <div className="promo-marquee-track">
              {[...activePromotions, ...activePromotions].map((promo, index) => (
                <div key={`${promo.id}-${index}`} className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                  {promo.bannerUrl && (
                    <RevealImage
                      src={promo.bannerUrl}
                      alt=""
                      className="h-10 w-14 rounded-md border border-white/20 object-cover"
                      fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
                      timeoutMs={2500}
                    />
                  )}
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                    {promo.code ? `Code ${promo.code}` : promo.title}
                  </span>
                  <span className="text-sm font-medium">
                    {describePromotion(promo, cakeNameBySlug)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── WHY US ──────────────────────────────────────── */}
      <section className="bg-accent/30 py-14 sm:py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-10 text-center sm:mb-12">
            <p className="uppercase tracking-widest text-xs text-primary font-semibold mb-3">Why Channah Cakes</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">Baked Different</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {WHY_US.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-border/30 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-serif text-lg font-bold mb-2 text-foreground">{title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED CAKES ──────────────────────────────── */}
      <section className="container mx-auto px-4 py-16 sm:py-20 md:py-24">
        <div className="mb-10 flex flex-col gap-4 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="uppercase tracking-widest text-xs text-primary font-semibold mb-3">Handpicked for You</p>
            <h2 className="font-serif text-4xl font-bold text-foreground">Featured Creations</h2>
          </div>
          <Link href="/menu" className="flex items-center gap-1 text-primary font-medium text-sm hover:underline whitespace-nowrap">
            View all cakes <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => <CakeCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredCards.map((cake) => {
              const href = typeof cake.id === "number" ? `/cake/${cake.id}` : "/menu";

              return (
              <Link key={cake.id} href={href}>
                <Card className="group overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl cursor-pointer bg-white">
                  <div className="aspect-[4/5] overflow-hidden relative">
                    <RevealImage
                      src={cake.imageUrl || DEFAULT_GALLERY_IMAGE_URL}
                      alt={cake.name}
                      className="object-cover group-hover:scale-105 transition-transform duration-700"
                      eager
                      fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
                    />
                    {cake.categoryName && (
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-medium rounded-full text-foreground shadow-sm">
                        {cake.categoryName}
                      </div>
                    )}
                    {cake.featured && (
                      <div className="absolute top-4 right-4 bg-primary text-white px-3 py-1 text-xs font-bold rounded-full shadow-sm">
                        Featured
                      </div>
                    )}
                  </div>
                  <CardContent className="p-6 text-center">
                    <h3 className="font-serif text-xl font-bold mb-1 group-hover:text-primary transition-colors">{cake.name}</h3>
                    <p className="text-secondary font-semibold tracking-wide">
                      {cake.price > 0 ? `KES ${cake.price.toLocaleString()}` : "Explore the collection"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── GALLERY — REAL WORK ──────────────────────────── */}
      <section className="overflow-hidden bg-[#170c10] py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10 md:mb-12">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Real Creations</p>
            <h2 className="font-serif text-4xl font-bold text-white sm:text-5xl">Our Work Speaks</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/55">Every cake in this gallery was made right here in Channah Cake House. Real details, real finishes, real celebrations.</p>
          </div>

          <motion.div
            className="space-y-4 sm:space-y-5"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.75, ease: "easeOut" }}
          >
            {galleryRows.map((row, rowIndex) => (
              <div key={rowIndex} className="work-rail">
                <div className={`work-rail-track ${rowIndex === 1 ? "work-rail-reverse" : ""}`}>
                  {[...row, ...row].map(({ imageUrl, label }, index) => (
                    <figure
                      key={`${imageUrl}-${index}`}
                      className="group relative h-52 w-[62vw] max-w-[260px] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-2xl shadow-black/30 sm:h-64 sm:w-[240px] lg:h-72 lg:w-[260px]"
                    >
                      <RevealImage
                        src={imageUrl}
                        alt={label}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                        fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
                        timeoutMs={2500}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,rgba(0,0,0,0.72)_100%)]" />
                      <figcaption className="absolute bottom-0 left-0 right-0 p-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 sm:p-4">
                        {label}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>

          <div className="text-center mt-12">
            <Button asChild className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 h-12 font-semibold">
              <Link href="/menu">Order Your Custom Cake</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── BRAND STORY / ABOUT ─────────────────────────── */}
      <section className="py-0 overflow-hidden">
        <div className="grid md:grid-cols-2">
          <div className="relative min-h-[500px]">
            <div className="absolute inset-0">
              <RevealImage
                src={galleryImage("cake-heels.jpeg")}
                alt="Custom cake by Channah Cakes"
                className="object-cover"
                eager
                fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
                placeholderClassName="bg-secondary/40"
              />
            </div>
          </div>
          <div className="bg-secondary flex items-center px-10 py-16 md:px-16">
            <div className="max-w-md">
              <p className="uppercase tracking-widest text-xs text-white/60 font-semibold mb-4">Our Story</p>
              <h2 className="font-serif text-4xl font-bold mb-6 text-white leading-snug">
                Crafted with Love<br />in Mombasa
              </h2>
              <p className="text-white/80 leading-relaxed mb-6">
                Channah Cake House is built on a true love for cakes. Every bite is crafted to melt in your mouth, bringing you a taste of joy in every slice. That's why choosing us is always the sweetest decision.
              </p>
              <p className="text-white/80 leading-relaxed mb-8">
                Let's cake it away, the Channah way.
              </p>
              <Button
                asChild
                className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-full px-8 h-12"
              >
                <Link href="/menu">Explore Our Menu</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── POPULAR CAKES ───────────────────────────────── */}
      <section className="bg-accent/30 py-16 sm:py-20 md:py-24">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="uppercase tracking-widest text-xs text-primary font-semibold mb-3">Bestsellers</p>
              <h2 className="font-serif text-4xl font-bold text-foreground">Crowd Favorites</h2>
            </div>
            <Link href="/menu" className="flex items-center gap-1 text-primary font-medium text-sm hover:underline whitespace-nowrap">
              See full menu <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {loadingPopular ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => <CakeCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {popularCards.map((cake) => {
                const href = typeof cake.id === "number" ? `/cake/${cake.id}` : "/menu";

                return (
                <Link key={cake.id} href={href}>
                  <Card className="group overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-xl cursor-pointer bg-white">
                    <div className="aspect-square overflow-hidden bg-muted">
                      <RevealImage
                        src={cake.imageUrl || DEFAULT_GALLERY_IMAGE_URL}
                        alt={cake.name}
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        eager
                        fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-base mb-1 truncate">{cake.name}</h3>
                      <p className="text-secondary text-sm font-semibold">
                        {cake.price > 0 ? `KES ${cake.price.toLocaleString()}` : "Handpicked favorite"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────── */}
      <section className="bg-background py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="overflow-hidden rounded-lg bg-[#170c10] text-white shadow-2xl shadow-secondary/10">
            <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
              <div className="relative min-h-[380px] p-8 sm:p-12 lg:p-14">
                <div className="absolute inset-0">
                  <RevealImage
                    src={landingImage("hero", "cake-heart.jpeg")}
                    alt=""
                    className="object-cover opacity-25"
                    fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
                    timeoutMs={2500}
                  />
                </div>
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,12,16,0.96),rgba(23,12,16,0.68))]" />
                <div className="relative z-10 flex h-full flex-col justify-between gap-12">
                  <div>
                    <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">Client Notes</p>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`rating-${highlightedReview?.id ?? "empty"}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        <StarRating rating={highlightedReview?.rating || 0} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <blockquote className="max-w-2xl">
                    {reviewsLoading ? (
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-2/3 bg-white/10" />
                        <Skeleton className="h-8 w-full bg-white/10" />
                        <Skeleton className="h-8 w-1/2 bg-white/10" />
                      </div>
                    ) : highlightedReview ? (
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={highlightedReview.id}
                          initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: -10, filter: "blur(6px)" }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        >
                          <p className="font-serif text-3xl leading-tight sm:text-5xl">
                            "{highlightedReview.body}"
                          </p>
                          <footer className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
                            {highlightedReview.authorName} / {highlightedReview.cakeName}
                          </footer>
                        </motion.div>
                      </AnimatePresence>
                    ) : (
                      <>
                        <p className="font-serif text-3xl leading-tight sm:text-5xl">
                          Fresh reviews from our cakes will appear here.
                        </p>
                        <footer className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
                          Live client notes
                        </footer>
                      </>
                    )}
                  </blockquote>
                </div>
              </div>

              <div className="border-t border-white/10 bg-white/[0.04] p-6 sm:p-8 lg:border-l lg:border-t-0">
                <div className="mb-8 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-white/10 p-4">
                    <p className="font-serif text-4xl font-bold">{averageRating ? averageRating.toFixed(1) : "0.0"}</p>
                    <p className="mt-1 text-xs uppercase tracking-widest text-white/50">Average rating</p>
                  </div>
                  <div className="rounded-lg border border-white/10 p-4">
                    <p className="font-serif text-4xl font-bold">{liveReviews.length}</p>
                    <p className="mt-1 text-xs uppercase tracking-widest text-white/50">Live reviews</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {reviewsLoading ? (
                    <>
                      <Skeleton className="h-28 w-full bg-white/10" />
                      <Skeleton className="h-28 w-full bg-white/10" />
                    </>
                  ) : secondaryReviews.length > 0 ? (
                    <AnimatePresence mode="popLayout" initial={false}>
                      {secondaryReviews.map((review, index) => (
                        <motion.blockquote
                          key={review.id}
                          layout
                          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                          exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                          transition={{ duration: 0.45, ease: "easeOut" }}
                          className="rounded-lg border border-white/10 bg-white/[0.05] p-5"
                          style={{ transitionDelay: `${index * 40}ms` }}
                        >
                          <StarRating rating={review.rating} />
                          <p className="mt-4 text-sm leading-6 text-white/78">"{review.body}"</p>
                          <footer className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                            {review.authorName} / {review.cakeName}
                          </footer>
                        </motion.blockquote>
                      ))}
                    </AnimatePresence>
                  ) : (
                    <blockquote className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
                      <p className="text-sm leading-6 text-white/78">
                        Reviews will appear here once customers start rating individual cakes.
                      </p>
                    </blockquote>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary py-14 sm:py-16 md:py-20">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute inset-0">
            <RevealImage
              src={galleryImage("cake-heart.jpeg")}
              alt=""
              className="object-cover"
              eager
              fallbackSrc={DEFAULT_GALLERY_IMAGE_URL}
              placeholderClassName="bg-primary/30"
              timeoutMs={2500}
            />
          </div>
        </div>
        <div className="relative z-10 container mx-auto px-4 text-center text-white">
          <h2 className="font-serif text-4xl md:text-5xl font-bold mb-4">Ready to Celebrate?</h2>
          <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
            Browse our full collection and order your perfect cake — delivered fresh to your door in Mombasa.
          </p>
          <Button
            size="lg"
            className="bg-white text-primary hover:bg-white/90 font-semibold rounded-full px-10 h-14 text-base shadow-lg"
            asChild
          >
            <Link href="/menu">Shop All Cakes</Link>
          </Button>
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
          gap: 1rem;
          padding-inline: 1rem;
          animation: workRail 42s linear infinite;
        }

        .promo-marquee {
          overflow: hidden;
        }

        .promo-marquee-track {
          display: flex;
          width: max-content;
          gap: 2rem;
          padding-inline: 1rem;
          animation: promoFlow 28s linear infinite;
        }

        .work-rail-reverse {
          animation-direction: reverse;
          animation-duration: 48s;
        }

        .work-rail:hover .work-rail-track {
          animation-play-state: paused;
        }

        @keyframes workRail {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes promoFlow {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .work-rail {
            overflow-x: auto;
            scrollbar-width: none;
          }

          .work-rail::-webkit-scrollbar {
            display: none;
          }

          .work-rail-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function describePromotion(
  promo: {
    code?: string | null;
    title: string;
    description?: string | null;
    discountPct?: number | null;
    discountAmount?: number | null;
    minimumOrderAmount?: number | null;
    applicableCakeSlugs?: string[] | null;
  },
  cakeNameBySlug: Map<string, string>,
) {
  if (promo.description && !promo.code && !promo.discountPct && !promo.discountAmount && !promo.minimumOrderAmount && !promo.applicableCakeSlugs?.length) {
    return promo.description;
  }

  const discountText =
    promo.discountAmount != null
      ? formatMoney(promo.discountAmount)
      : promo.discountPct != null
        ? `${promo.discountPct}%`
        : "a special offer";

  const scopeText = (() => {
    if (promo.applicableCakeSlugs && promo.applicableCakeSlugs.length > 0) {
      const names = promo.applicableCakeSlugs
        .map((slug) => cakeNameBySlug.get(slug) ?? humanizeSlug(slug))
        .join(", ");
      return `on ${names}`;
    }

    if (promo.minimumOrderAmount != null) {
      return `on orders of ${formatMoney(promo.minimumOrderAmount)} or more`;
    }

    return "on your order";
  })();

  if (promo.code) {
    return `Use code ${promo.code} to get ${discountText} off ${scopeText}.`;
  }

  if (promo.description) {
    return promo.description;
  }

  return `Get ${discountText} off ${scopeText}.`;
}

