import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, MapPin, Star, Tag } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import {
  useGetPopularCakes,
  useListCakes,
  useListCategories,
  useListPromotions,
  type Cake,
  type Promotion,
} from "@workspace/api-client-react";
import { CoverSlideshow } from "@/components/cover-slideshow";
import { CustomCakeButton, HighlightsRow } from "@/components/homepage-selling-points";
import { RevealImage } from "@/components/reveal-image";
import { ProductCard, ProductCardSkeleton } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiBaseUrl } from "@/lib/api-base";
import { DEFAULT_HOMEPAGE_GALLERY, fetchHomepageGallery, type HomepageGalleryItem } from "@/lib/homepage-gallery";
import { DEFAULT_HOMEPAGE_HERO, fetchHomepageHero, type HomepageHeroContent } from "@/lib/homepage-hero";
import { DEFAULT_HOMEPAGE_HIGHLIGHTS, fetchHomepageHighlights } from "@/lib/homepage-highlights";
import { DEFAULT_CAKE_IMAGE_URL, DEFAULT_GALLERY_IMAGE_URL, DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";
import { WHATSAPP_ORDER_URL, getOpenStatus } from "@/lib/store-info";
import { SECTION_SCROLL_OFFSET, categorySectionId, scrollToSection } from "@/lib/store-sections";
import { cn, formatKes } from "@/lib/utils";

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
  description: string | null;
  cakes: Cake[];
  imageUrl: string | null;
  // Categories get a picture in the row under the store header; "Popular" doesn't.
  isCategory: boolean;
};

// Best-rated and newest first. Reviews are optional on the storefront: any failure just hides them.
async function fetchStoreReviews(): Promise<CakeReview[]> {
  const response = await fetch(`${getApiBaseUrl()}/api/reviews`);
  if (!response.ok) return [];
  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];
  return [...(data as CakeReview[])].sort((a, b) =>
    b.rating !== a.rating ? b.rating - a.rating : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function useStoreReviews() {
  const { data } = useQuery({ queryKey: ["store-reviews"], queryFn: fetchStoreReviews, retry: 1 });
  return data ?? [];
}

// Signs the customer is moving around the page themselves.
const USER_SCROLL_EVENTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

function sortAvailableFirst(cakes: Cake[]) {
  return [...cakes].sort((a, b) => Number(b.available) - Number(a.available));
}

export default function Home() {
  const { data: cakes, isLoading: loadingCakes } = useListCakes();
  const { data: categories, isLoading: loadingCategories } = useListCategories();
  const { data: popularCakes } = useGetPopularCakes();
  const { data: promotions } = useListPromotions();
  const { data: homepageHero } = useQuery({
    queryKey: ["homepage-hero"],
    queryFn: fetchHomepageHero,
    placeholderData: DEFAULT_HOMEPAGE_HERO,
  });
  // The benefits row and the WhatsApp custom-cake button, edited in Admin → Homepage.
  const { data: sellingPoints = DEFAULT_HOMEPAGE_HIGHLIGHTS } = useQuery({
    queryKey: ["homepage-highlights"],
    queryFn: fetchHomepageHighlights,
    placeholderData: DEFAULT_HOMEPAGE_HIGHLIGHTS,
  });

  const [showCategoryBar, setShowCategoryBar] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const categoryPicturesRef = useRef<HTMLDivElement>(null);
  const chipScrollerRef = useRef<HTMLDivElement>(null);
  const loading = loadingCakes || loadingCategories;

  const sections = useMemo<CatalogSection[]>(() => {
    const list = cakes ?? [];
    const result: CatalogSection[] = [];

    const popular = (popularCakes ?? []).filter((cake) => cake.available).slice(0, 8);
    if (popular.length > 0) {
      result.push({ id: "popular", title: "Popular", description: null, cakes: popular, imageUrl: popular[0].imageUrl ?? null, isCategory: false });
    }

    const categoryIds = new Set<number>();
    for (const category of categories ?? []) {
      categoryIds.add(category.id);
      const inCategory = sortAvailableFirst(list.filter((cake) => cake.categoryId === category.id));
      if (inCategory.length > 0) {
        result.push({
          id: categorySectionId(category.id),
          title: category.name,
          description: category.description?.trim() || null,
          cakes: inCategory,
          imageUrl: category.imageUrl || inCategory[0].imageUrl || null,
          isCategory: true,
        });
      }
    }

    const uncategorized = sortAvailableFirst(list.filter((cake) => cake.categoryId == null || !categoryIds.has(cake.categoryId)));
    if (uncategorized.length > 0) {
      result.push({
        id: "more-cakes",
        title: result.some((section) => section.isCategory) ? "More cakes" : "All cakes",
        description: null,
        cakes: uncategorized,
        imageUrl: uncategorized[0].imageUrl ?? null,
        isCategory: true,
      });
    }

    return result;
  }, [cakes, categories, popularCakes]);

  const now = Date.now();
  const activePromotions = (promotions ?? []).filter((promo) => {
    if (!promo.active) return false;
    if (promo.showInStrip === false) return false;
    if (promo.startsAt && new Date(promo.startsAt).getTime() > now) return false;
    if (promo.endsAt && new Date(promo.endsAt).getTime() < now) return false;
    return true;
  });
  const cakeNameBySlug = new Map((cakes ?? []).map((cake) => [cake.slug, cake.name]));

  // The category bar slides in once the category pictures have scrolled out of view.
  useEffect(() => {
    const pictures = categoryPicturesRef.current;
    if (!pictures) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowCategoryBar(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(pictures);
    return () => observer.disconnect();
  }, []);

  // Highlight the chip for whichever section is currently under the sticky bars.
  useEffect(() => {
    if (sections.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      let current = sections[0].id;
      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element && element.getBoundingClientRect().top <= SECTION_SCROLL_OFFSET + 8) {
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
  }, [sections]);

  // Keep the active chip visible inside the horizontally scrolling bar.
  useEffect(() => {
    const scroller = chipScrollerRef.current;
    const chip = scroller?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`);
    if (!scroller || !chip) return;
    scroller.scrollTo({ left: chip.offsetLeft - scroller.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [activeSection, showCategoryBar]);

  // Links like /#category-3 (from the menu on other pages) open the shop at that category. Popular cakes,
  // offers and reviews can arrive a moment later and push it down (browsers don't always compensate),
  // so keep it in place while the page settles, until the customer starts scrolling or for 3 seconds.
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (!target) return;
    const observer = new ResizeObserver(() => scrollToSection(target, "auto"));
    const release = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      for (const type of USER_SCROLL_EVENTS) window.removeEventListener(type, finish);
    };
    const finish = () => {
      release();
      // Drop "#category-…" from the address so a refresh starts at the top.
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    };
    const timer = window.setTimeout(finish, 3000);
    for (const type of USER_SCROLL_EVENTS) window.addEventListener(type, finish, { passive: true });
    observer.observe(document.body);
    return release;
  }, []);

  const categorySections = sections.filter((section) => section.isCategory);

  return (
    <div className="w-full">
      {showCategoryBar && sections.length > 0 && (
        <div className="fixed inset-x-0 top-14 z-30 border-b border-border/70 bg-background animate-in fade-in slide-in-from-top-2 duration-200">
          <div ref={chipScrollerRef} className="no-scrollbar relative mx-auto flex max-w-2xl gap-2 overflow-x-auto px-3 py-2 sm:px-4">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                data-section={section.id}
                onClick={() => scrollToSection(section.id)}
                aria-current={activeSection === section.id ? "true" : undefined}
                className={cn(
                  "h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
                  activeSection === section.id ? "bg-foreground text-background" : "bg-muted text-foreground/80 hover:bg-muted/70",
                )}
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-3 pb-8 sm:px-4">
        <StoreHeader hero={homepageHero ?? DEFAULT_HOMEPAGE_HERO} />

        <nav ref={categoryPicturesRef} className="no-scrollbar -mx-3 mt-5 overflow-x-auto sm:-mx-4" aria-label="Shop by category">
          <div className="mx-auto flex w-max gap-2 px-3 sm:px-4">
            {loading
              ? [1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex w-[4.5rem] flex-col items-center gap-1.5">
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))
              : categorySections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className="flex w-[4.5rem] flex-col items-center gap-1.5 rounded-xl py-1 transition-colors hover:bg-muted/60"
                  >
                    <span className="h-14 w-14 overflow-hidden rounded-2xl border border-border/60 bg-muted">
                      <RevealImage
                        src={section.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                        alt=""
                        className="object-cover"
                        fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                        placeholderClassName="bg-muted"
                      />
                    </span>
                    <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-foreground/80">{section.title}</span>
                  </button>
                ))}
          </div>
        </nav>

        {sellingPoints.showHighlights && <HighlightsRow highlights={sellingPoints.highlights} className="mt-4" />}

        <div className="mt-4 space-y-3">
          {activePromotions.length > 0 && <OffersCard promotions={activePromotions} cakeNameBySlug={cakeNameBySlug} />}

          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-4">
              <Skeleton className="h-5 w-32" />
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 min-[520px]:grid-cols-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            </div>
          ) : sections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
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
            sections.map((section, index) => (
              <Fragment key={section.id}>
                <section id={section.id} aria-labelledby={`${section.id}-title`} className="rounded-2xl border border-border bg-card p-4">
                  <h2 id={`${section.id}-title`} className="text-base font-bold tracking-tight">
                    {section.title}
                  </h2>
                  {section.description && <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{section.description}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 min-[520px]:grid-cols-3 sm:grid-cols-4">
                    {section.cakes.map((cake) => (
                      <ProductCard key={cake.id} cake={cake} />
                    ))}
                  </div>
                </section>
                {index === 0 && sellingPoints.showCustomCakeButton && (
                  <CustomCakeButton title={sellingPoints.customCakeTitle} text={sellingPoints.customCakeText} />
                )}
              </Fragment>
            ))
          )}

          <RecentWorkCard />
          <ReviewsCard />
          <AboutCard hero={homepageHero ?? DEFAULT_HOMEPAGE_HERO} />
        </div>
      </div>
    </div>
  );
}

function StoreHeader({ hero }: { hero: HomepageHeroContent }) {
  const coverSlides = hero.slides.filter((slide) => slide.imageUrl);
  const [status, setStatus] = useState(() => getOpenStatus());
  const reviews = useStoreReviews();
  const averageRating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;

  useEffect(() => {
    const timer = window.setInterval(() => setStatus(getOpenStatus()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="pt-3 text-center">
      <CoverSlideshow key={coverSlides.map((slide) => slide.imageUrl).join("|")} slides={coverSlides} className="h-28 rounded-2xl sm:h-36" />
      <div className="relative mx-auto -mt-12 h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-white shadow-md">
        <RevealImage
          src={DEFAULT_LOGO_IMAGE_URL}
          alt="Channah Cakes logo"
          className="object-contain p-2"
          eager
          placeholderClassName="bg-transparent"
          timeoutMs={2000}
        />
      </div>
      <h1 className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">{hero.brandLine}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{hero.headline}</p>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-foreground/80">
          <MapPin className="h-3.5 w-3.5" /> Mombasa
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-foreground/80">
          <Clock className="h-3.5 w-3.5" />
          <span className={cn("font-semibold", status.isOpen ? "text-emerald-600" : "text-muted-foreground")}>
            {status.isOpen ? "Open" : "Closed"}
          </span>
          · {status.label}
        </span>
        {averageRating !== null && (
          <a
            href="#reviews-title"
            onClick={(event) => {
              event.preventDefault();
              document.getElementById("reviews-title")?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}
            aria-label={`Rated ${averageRating.toFixed(1)} out of 5 from ${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-foreground/80 hover:bg-muted/70"
          >
            <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
            <span className="font-semibold text-foreground">{averageRating.toFixed(1)}</span>
            <span>({reviews.length})</span>
          </a>
        )}
      </div>
    </section>
  );
}

function AboutCard({ hero }: { hero: HomepageHeroContent }) {
  if (!hero.description) return null;
  return (
    <section aria-labelledby="about-title" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="about-title" className="text-base font-bold tracking-tight">
        About {hero.brandLine}
      </h2>
      <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">{hero.description}</p>
    </section>
  );
}

function OffersCard({ promotions, cakeNameBySlug }: { promotions: Promotion[]; cakeNameBySlug: Map<string, string> }) {
  return (
    <section aria-label="Offers" className="divide-y divide-border rounded-2xl border border-border bg-card">
      {promotions.map((promo) => (
        <div key={promo.id} className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Tag className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{promo.title}</p>
            <p className="text-xs leading-5 text-muted-foreground">{describePromotion(promo, cakeNameBySlug)}</p>
          </div>
          {promo.code && (
            <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold tracking-wide text-primary-foreground">{promo.code}</span>
          )}
        </div>
      ))}
    </section>
  );
}

function RecentWorkCard() {
  const { data: homepageGallery } = useQuery({
    queryKey: ["homepage-gallery"],
    queryFn: fetchHomepageGallery,
    placeholderData: DEFAULT_HOMEPAGE_GALLERY,
  });
  const items: HomepageGalleryItem[] = homepageGallery?.items ?? DEFAULT_HOMEPAGE_GALLERY.items;

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-work-title" className="rounded-2xl border border-border bg-card p-4">
      <h2 id="recent-work-title" className="text-base font-bold tracking-tight">
        Recent creations
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Real cakes, made right here at Channah Cake House.</p>
      <div className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4">
        {items.map(({ imageUrl, label }) => (
          <figure key={`${imageUrl}-${label}`} className="w-32 shrink-0 snap-start sm:w-36">
            <div className="aspect-[4/5] overflow-hidden rounded-xl bg-muted">
              <RevealImage src={imageUrl} alt={label} className="object-cover" fallbackSrc={DEFAULT_GALLERY_IMAGE_URL} timeoutMs={7000} />
            </div>
            <figcaption className="mt-1.5 truncate text-xs font-medium text-muted-foreground">{label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const REVIEW_CARD_STEP = 256 + 12; // card width + gap

// Customers swipe through reviews themselves (moving text is hard to read); computers with a mouse also get arrows.
function ReviewsCard() {
  const reviews = useStoreReviews();
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () =>
      setEdges({ atStart: row.scrollLeft <= 4, atEnd: row.scrollLeft + row.clientWidth >= row.scrollWidth - 4 });
    update();
    row.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      row.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [reviews.length]);

  if (reviews.length === 0) return null;

  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  const scrollReviews = (direction: 1 | -1) => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rowRef.current?.scrollBy({ left: direction * REVIEW_CARD_STEP, behavior: still ? "auto" : "smooth" });
  };

  return (
    <section aria-labelledby="reviews-title" className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="reviews-title" className="text-base font-bold tracking-tight">
          Customer reviews
        </h2>
        <div className="flex items-center gap-3">
          <p className="flex items-center gap-1 text-sm font-semibold">
            <Star className="h-4 w-4 fill-primary text-primary" />
            {averageRating.toFixed(1)}
            <span className="font-normal text-muted-foreground">
              · {reviews.length} {reviews.length === 1 ? "review" : "reviews"}
            </span>
          </p>
          {reviews.length > 1 && (
            <div className="hidden gap-1 pointer-fine:flex">
              <button
                type="button"
                onClick={() => scrollReviews(-1)}
                disabled={edges.atStart}
                aria-label="Previous reviews"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollReviews(1)}
                disabled={edges.atEnd}
                aria-label="More reviews"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div ref={rowRef} className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4">
        {reviews.slice(0, 12).map((review) => (
          <figure key={review.id} className="flex w-64 shrink-0 snap-start flex-col rounded-xl bg-muted/60 p-4">
            <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Star key={index} className={cn("h-3.5 w-3.5", index < review.rating ? "fill-primary text-primary" : "text-border")} />
              ))}
            </div>
            <blockquote className="mt-2 line-clamp-4 text-sm leading-6">“{review.body}”</blockquote>
            <figcaption className="mt-auto pt-3 text-xs font-semibold text-muted-foreground">
              {review.authorName} · {review.cakeName}
            </figcaption>
          </figure>
        ))}
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
