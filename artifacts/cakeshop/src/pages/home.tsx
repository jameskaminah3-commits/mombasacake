import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Clock, MapPin, Phone, Search, Share2, ShieldCheck, Star, Tag, Truck } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  useGetPopularCakes,
  useListCakes,
  useListCategories,
  useListPromotions,
  type Cake,
  type Promotion,
} from "@workspace/api-client-react";
import { RevealImage } from "@/components/reveal-image";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import { DEFAULT_HOMEPAGE_GALLERY, fetchHomepageGallery, type HomepageGalleryItem } from "@/lib/homepage-gallery";
import { DEFAULT_HOMEPAGE_HERO, fetchHomepageHero, type HomepageHeroContent } from "@/lib/homepage-hero";
import { DEFAULT_GALLERY_IMAGE_URL, DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";
import { STORE_HOURS, STORE_LOCATION, STORE_PHONE, WHATSAPP_ORDER_URL } from "@/lib/store-info";
import { cn, formatKes } from "@/lib/utils";

// Sticky header (56px) + sticky category bar (56px) + a little breathing room.
const CATALOG_SCROLL_OFFSET = 120;
const COVER_ROTATION_MS = 5000;

const STORE_HIGHLIGHTS = [
  { icon: MapPin, label: STORE_LOCATION },
  { icon: Clock, label: STORE_HOURS.map(({ days, hours }) => `${days} ${hours}`).join(" · ") },
  { icon: Truck, label: "Delivery across Mombasa" },
  { icon: CalendarClock, label: "Order 24 hrs ahead" },
  { icon: ShieldCheck, label: "Secure M-Pesa checkout" },
];

const actionButtonClass =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border text-sm font-semibold transition-colors hover:bg-muted sm:px-5 [&_svg]:shrink-0";

type CakeReview = {
  id: number;
  cakeId: number;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
  cakeName: string;
};

type CatalogSection = {
  id: string;
  title: string;
  cakes: Cake[];
  layout: "row" | "grid";
};

function sortAvailableFirst(cakes: Cake[]) {
  return [...cakes].sort((a, b) => Number(b.available) - Number(a.available));
}

function scrollToElement(element: HTMLElement, offset: number) {
  const top = element.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
}

export default function Home() {
  return <StorePage variant="store" />;
}

export function StorePage({ variant }: { variant: "store" | "menu" }) {
  const { data: cakes, isLoading: loadingCakes } = useListCakes();
  const { data: categories, isLoading: loadingCategories } = useListCategories();
  const { data: popularCakes } = useGetPopularCakes();
  const { data: promotions } = useListPromotions();
  const { data: homepageHero } = useQuery({
    queryKey: ["homepage-hero"],
    queryFn: fetchHomepageHero,
    placeholderData: DEFAULT_HOMEPAGE_HERO,
  });

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const catalogRef = useRef<HTMLElement>(null);
  const chipScrollerRef = useRef<HTMLDivElement>(null);

  const searchTerm = query.trim().toLowerCase();
  const searching = searchTerm.length > 0;
  const loading = loadingCakes || loadingCategories;

  const sections = useMemo<CatalogSection[]>(() => {
    const list = cakes ?? [];
    const result: CatalogSection[] = [];

    const popular = (popularCakes ?? []).filter((cake) => cake.available).slice(0, 10);
    if (popular.length > 0) {
      result.push({ id: "popular", title: "Popular", cakes: popular, layout: "row" });
    }

    const categoryIds = new Set<number>();
    for (const category of categories ?? []) {
      categoryIds.add(category.id);
      const inCategory = list.filter((cake) => cake.categoryId === category.id);
      if (inCategory.length > 0) {
        result.push({ id: `category-${category.id}`, title: category.name, cakes: sortAvailableFirst(inCategory), layout: "grid" });
      }
    }

    const uncategorized = list.filter((cake) => cake.categoryId == null || !categoryIds.has(cake.categoryId));
    if (uncategorized.length > 0) {
      const hasCategoryGrids = result.some((section) => section.layout === "grid");
      result.push({
        id: "more-cakes",
        title: hasCategoryGrids ? "More cakes" : "All cakes",
        cakes: sortAvailableFirst(uncategorized),
        layout: "grid",
      });
    }

    return result;
  }, [cakes, categories, popularCakes]);

  const searchResults = useMemo(() => {
    if (!searching) return [];
    return sortAvailableFirst(
      (cakes ?? []).filter((cake) =>
        [cake.name, cake.description, cake.categoryName].some((field) => field?.toLowerCase().includes(searchTerm)),
      ),
    );
  }, [cakes, searching, searchTerm]);

  const now = Date.now();
  const activePromotions = (promotions ?? []).filter((promo) => {
    if (!promo.active) return false;
    if (promo.showInStrip === false) return false;
    if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return false;
    if (promo.endsAt && new Date(promo.endsAt).getTime() < now) return false;
    return true;
  });
  const cakeNameBySlug = new Map((cakes ?? []).map((cake) => [cake.slug, cake.name]));

  // Highlight the category chip for whichever section is currently under the sticky bar.
  useEffect(() => {
    if (searching || sections.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0].id;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= CATALOG_SCROLL_OFFSET + 8) {
          current = section.id;
        }
      }
      setActiveSection(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sections, searching]);

  // Keep the active chip visible inside the horizontally scrolling chip bar.
  useEffect(() => {
    const scroller = chipScrollerRef.current;
    const chip = scroller?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`);
    if (!scroller || !chip) return;
    scroller.scrollTo({ left: chip.offsetLeft - scroller.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [activeSection]);

  // When a search starts while scrolled deep into the menu, bring the results into view.
  useEffect(() => {
    const catalog = catalogRef.current;
    if (searching && catalog && catalog.getBoundingClientRect().top < 0) {
      scrollToElement(catalog, 56);
    }
  }, [searching]);

  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) scrollToElement(element, CATALOG_SCROLL_OFFSET);
  };

  return (
    <div className="flex w-full flex-col">
      {variant === "store" ? (
        <StoreHeader hero={homepageHero ?? DEFAULT_HOMEPAGE_HERO} />
      ) : (
        <div className="mx-auto w-full max-w-5xl px-4 pt-6">
          <h1 className="text-2xl font-extrabold tracking-tight">Our menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse our collection of artisan cakes. Each piece is crafted to perfection.
          </p>
        </div>
      )}

      {activePromotions.length > 0 && <OffersRow promotions={activePromotions} cakeNameBySlug={cakeNameBySlug} />}

      <section ref={catalogRef} id="menu" aria-label="Menu" className="pt-3">
        <div className="sticky top-14 z-30 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
            {searchOpen ? (
              <>
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Escape" && closeSearch()}
                    placeholder="Search cakes"
                    aria-label="Search cakes"
                    autoFocus
                    className="h-10 w-full rounded-full bg-muted pl-10 pr-4 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring sm:text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={closeSearch}
                  className="h-10 shrink-0 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search cakes"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/70"
                >
                  <Search className="h-4 w-4" />
                </button>
                <div ref={chipScrollerRef} className="no-scrollbar relative flex flex-1 gap-2 overflow-x-auto">
                  {loading
                    ? [1, 2, 3].map((i) => <span key={i} className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-muted" />)
                    : sections.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          data-section={section.id}
                          onClick={() => scrollToSection(section.id)}
                          aria-current={activeSection === section.id ? "true" : undefined}
                          className={cn(
                            "h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
                            activeSection === section.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground/80 hover:bg-muted/70",
                          )}
                        >
                          {section.title}
                        </button>
                      ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-5xl px-4 pb-12">
          {loading ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 pt-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : searching ? (
            <div className="pt-5">
              <p className="mb-3 text-sm text-muted-foreground">
                {searchResults.length} {searchResults.length === 1 ? "result" : "results"} for “{query.trim()}”
              </p>
              {searchResults.length === 0 ? (
                <div className="rounded-2xl bg-muted/60 px-6 py-10 text-center text-sm text-muted-foreground">
                  No cakes match your search. Try another word, or{" "}
                  <a href={WHATSAPP_ORDER_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline">
                    ask us on WhatsApp
                  </a>
                  .
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
                  {searchResults.map((cake) => (
                    <ProductCard key={cake.id} cake={cake} />
                  ))}
                </div>
              )}
            </div>
          ) : sections.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <p className="font-semibold">Our menu is being updated</p>
              <p className="mt-1 text-sm text-muted-foreground">Message us on WhatsApp and we'll help you order your cake.</p>
              <a
                href={WHATSAPP_ORDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1fb958]"
              >
                <SiWhatsapp className="h-4 w-4" /> Order on WhatsApp
              </a>
            </div>
          ) : (
            sections.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="pt-6">
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 id={`${section.id}-title`} className="text-lg font-bold tracking-tight">
                    {section.title}
                  </h2>
                  <span className="text-xs font-medium text-muted-foreground">
                    {section.cakes.length} {section.cakes.length === 1 ? "cake" : "cakes"}
                  </span>
                </div>
                {section.layout === "row" ? (
                  <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:gap-4">
                    {section.cakes.map((cake) => (
                      <ProductCard
                        key={cake.id}
                        cake={cake}
                        className="w-40 shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
                    {section.cakes.map((cake) => (
                      <ProductCard key={cake.id} cake={cake} />
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>
      </section>

      {variant === "store" && (
        <>
          <RecentWork />
          <ReviewsStrip />
          <section className="border-t border-border">
            <div className="mx-auto max-w-5xl px-4 py-10">
              <h2 className="text-lg font-bold tracking-tight">About Channah Cake House</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Channah Cake House is built on a true love for cakes. Every bite is crafted to melt in your mouth,
                bringing you a taste of joy in every slice. That's why choosing us is always the sweetest decision.
              </p>
              <p className="mt-3 text-sm font-semibold text-primary">Let's cake it away, the Channah way.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StoreHeader({ hero }: { hero: HomepageHeroContent }) {
  const { toast } = useToast();
  const slides = hero.slides.length > 0 ? hero.slides : DEFAULT_HOMEPAGE_HERO.slides;
  // The previous photo stays underneath while the new one fades in on top (a CSS cross-fade).
  const [cover, setCover] = useState<{ active: number; previous: number | null }>({ active: 0, previous: null });
  const activeSlide = cover.active % slides.length;
  const slide = slides[activeSlide];
  const previousSlide = cover.previous === null ? null : slides[cover.previous % slides.length];
  const showSlide = (index: number) => setCover((current) => ({ active: index, previous: current.active }));

  // Fetch only the next cover photo (not all of them up front) so first visits on mobile data stay light.
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setTimeout(() => {
      const next = new Image();
      next.src = slides[(activeSlide + 1) % slides.length].imageUrl;
    }, COVER_ROTATION_MS / 2);
    return () => window.clearTimeout(timer);
  }, [slides, activeSlide]);

  useEffect(() => {
    if (slides.length <= 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setCover((current) => ({ active: (current.active + 1) % slides.length, previous: current.active })),
      COVER_ROTATION_MS,
    );
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const handleShare = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: hero.brandLine, text: hero.headline, url });
      } catch {
        // Closing the share sheet rejects; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Share it with friends and family." });
    } catch {
      toast({ title: "Share this link", description: url });
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl sm:px-4 sm:pt-4">
      <div className="relative h-32 overflow-hidden bg-muted sm:h-64 sm:rounded-2xl md:h-72">
        {previousSlide && previousSlide.imageUrl !== slide.imageUrl && (
          <img src={previousSlide.imageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <img
          key={slide.imageUrl}
          src={slide.imageUrl}
          alt={slide.title}
          className={cn("absolute inset-0 h-full w-full object-cover", previousSlide && "animate-in fade-in duration-700")}
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        {slides.length > 1 && (
          <div className="absolute bottom-1.5 right-2 flex sm:bottom-2.5 sm:right-3">
            {slides.map((item, index) => {
              const active = index === activeSlide;
              return (
                <button
                  key={item.imageUrl}
                  type="button"
                  onClick={() => showSlide(index)}
                  aria-label={`Show ${item.label}`}
                  aria-pressed={active}
                  className="group flex h-6 min-w-6 items-center justify-center"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-all",
                      active ? "w-5 bg-white" : "w-1.5 bg-white/60 group-hover:bg-white/80",
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="relative -mt-9 h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-white shadow-md sm:-mt-12 sm:h-24 sm:w-24">
            <RevealImage
              src={DEFAULT_LOGO_IMAGE_URL}
              alt="Channah Cakes logo"
              className="object-contain p-1"
              eager
              placeholderClassName="bg-transparent"
              timeoutMs={2000}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <a
              href={WHATSAPP_ORDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat on WhatsApp"
              data-inline-whatsapp
              className={cn(actionButtonClass, "border-transparent bg-[#25D366] text-white hover:bg-[#1fb958]")}
            >
              <SiWhatsapp className="h-5 w-5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>
            <a href={`tel:${STORE_PHONE}`} aria-label="Call us" className={actionButtonClass}>
              <Phone className="h-5 w-5" />
              <span className="hidden sm:inline">Call</span>
            </a>
            <button type="button" onClick={handleShare} aria-label="Share this shop" className={actionButtonClass}>
              <Share2 className="h-5 w-5" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>

        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{hero.brandLine}</h1>
        <p className="mt-0.5 text-sm font-semibold text-primary">{hero.headline}</p>
        <p className="mt-1.5 line-clamp-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:line-clamp-none">{hero.description}</p>

        {/* One swipeable line on phones so the menu starts on the first screen */}
        <ul className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {STORE_HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground/80"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function OffersRow({ promotions, cakeNameBySlug }: { promotions: Promotion[]; cakeNameBySlug: Map<string, string> }) {
  return (
    <section aria-label="Offers" className="mx-auto w-full max-w-5xl px-4 pt-4">
      <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4">
        {promotions.map((promo) => (
          <div
            key={promo.id}
            className="flex w-[min(20rem,85vw)] shrink-0 snap-start items-center gap-3 rounded-2xl border border-primary/15 bg-accent p-2.5"
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-primary/10">
              {promo.bannerUrl ? (
                <RevealImage src={promo.bannerUrl} alt="" className="object-cover" fallbackSrc={DEFAULT_GALLERY_IMAGE_URL} timeoutMs={2500} />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Tag className="h-5 w-5 text-primary" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-sm font-bold">{promo.title}</p>
                {promo.code && (
                  <span className="shrink-0 rounded-md border border-dashed border-primary/40 bg-background px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-primary">
                    {promo.code}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-xs leading-4 text-muted-foreground">{describePromotion(promo, cakeNameBySlug)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentWork() {
  const { data: homepageGallery } = useQuery({
    queryKey: ["homepage-gallery"],
    queryFn: fetchHomepageGallery,
    placeholderData: DEFAULT_HOMEPAGE_GALLERY,
  });
  const items: HomepageGalleryItem[] = homepageGallery?.items ?? DEFAULT_HOMEPAGE_GALLERY.items;

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-work-title" className="border-t border-border bg-muted/40">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h2 id="recent-work-title" className="text-lg font-bold tracking-tight">
          Recent creations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Real cakes, made right here at Channah Cake House.</p>
        <div className="no-scrollbar -mx-4 mt-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
          {items.map(({ imageUrl, label }) => (
            <figure key={`${imageUrl}-${label}`} className="w-36 shrink-0 snap-start sm:w-44">
              <div className="aspect-[4/5] overflow-hidden rounded-xl bg-muted">
                <RevealImage src={imageUrl} alt={label} className="object-cover" fallbackSrc={DEFAULT_GALLERY_IMAGE_URL} timeoutMs={7000} />
              </div>
              <figcaption className="mt-1.5 truncate text-xs font-medium text-muted-foreground">{label}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewsStrip() {
  const [reviews, setReviews] = useState<CakeReview[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/api/reviews`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: CakeReview[]) => {
        if (!Array.isArray(data)) return;
        setReviews(
          [...data].sort((a, b) =>
            b.rating !== a.rating ? b.rating - a.rating : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        );
      })
      .catch(() => {
        // Reviews are optional on the storefront; hide the section if they fail to load.
      });
    return () => controller.abort();
  }, []);

  if (reviews.length === 0) return null;

  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  return (
    <section aria-labelledby="reviews-title" className="border-t border-border">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-end justify-between gap-4">
          <h2 id="reviews-title" className="text-lg font-bold tracking-tight">
            Customer reviews
          </h2>
          <p className="flex items-center gap-1 text-sm font-semibold">
            <Star className="h-4 w-4 fill-primary text-primary" />
            {averageRating.toFixed(1)}
            <span className="font-normal text-muted-foreground">
              · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </span>
          </p>
        </div>
        <div className="no-scrollbar -mx-4 mt-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
          {reviews.slice(0, 12).map((review) => (
            <figure key={review.id} className="flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-border p-4">
              <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className={cn("h-4 w-4", index < review.rating ? "fill-primary text-primary" : "text-border")} />
                ))}
              </div>
              <blockquote className="mt-2 line-clamp-4 text-sm leading-6">“{review.body}”</blockquote>
              <figcaption className="mt-auto pt-3 text-xs font-semibold text-muted-foreground">
                {review.authorName} · {review.cakeName}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function humanizeSlug(value: string) {
  return value.replace(/-/g, " ");
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
      ? formatKes(promo.discountAmount)
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
      return `on orders of ${formatKes(promo.minimumOrderAmount)} or more`;
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
