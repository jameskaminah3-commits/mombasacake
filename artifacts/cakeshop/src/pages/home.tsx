import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetFeaturedCakes, useGetPopularCakes, useListPromotions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Truck, Clock, ShieldCheck, ChevronRight } from "lucide-react";

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

const WHY_US = [
  { icon: Star, title: "Artisan Quality", desc: "Every cake is handcrafted from scratch using premium chocolate, farm-fresh eggs, and the finest Kenyan ingredients." },
  { icon: Truck, title: "Mombasa Delivery", desc: "We deliver across Mombasa County. Order by noon for same-day delivery on selected items." },
  { icon: Clock, title: "Made to Order", desc: "Fresh-baked daily. Custom orders accepted 48 hours in advance for weddings and events." },
  { icon: ShieldCheck, title: "Secure MPesa Checkout", desc: "Pay safely and instantly with your Safaricom MPesa — no cards, no hassle." },
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
    text: "Ordered the custom wedding cake and it was beyond anything we imagined. Stunning presentation and the flavour was divine.",
  },
  {
    name: "Fatuma A.",
    location: "Bamburi",
    rating: 5,
    text: "The butterfly cake is the best thing I have ever seen and tasted. Delivery was prompt and the packaging was beautiful.",
  },
];

const GALLERY = [
  { src: "/gallery/cake-lady-dress.jpeg",     label: "Lady in Blue"         },
  { src: "/gallery/cake-gold-butterfly.jpeg",  label: "Gold Butterfly"       },
  { src: "/gallery/cake-purple-butterfly.jpeg",label: "Purple Butterfly"     },
  { src: "/gallery/cake-blue-gold.jpeg",       label: "Blue & Gold"          },
  { src: "/gallery/cake-heels.jpeg",           label: "Glam Heels"           },
  { src: "/gallery/cake-princess-wave.jpeg",   label: "Princess"             },
  { src: "/gallery/cake-red-butterfly.jpeg",   label: "Red Butterfly"        },
  { src: "/gallery/cake-white-gold.jpeg",      label: "White & Gold"         },
  { src: "/gallery/cake-kenya-flag.jpeg",      label: "Kenya Flag"           },
  { src: "/gallery/cake-tuxedo.jpeg",          label: "Tuxedo"               },
  { src: "/gallery/cake-stitch.jpeg",          label: "Stitch Birthday"      },
  { src: "/gallery/cake-butterfly-birthday.jpeg", label: "Butterfly Birthday"},
  { src: "/gallery/cake-teenager.jpeg",        label: "Teenager Special"     },
  { src: "/gallery/cake-spiderman.jpeg",       label: "Spiderman Party"      },
  { src: "/gallery/cake-girl-jeans.jpeg",      label: "Girls Vibes"          },
  { src: "/gallery/cake-heart.jpeg",           label: "Heart Anniversary"    },
];

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
  const { data: promotions } = useListPromotions();

  const activePromotions = promotions?.filter((p) => p.active) || [];

  return (
    <div className="flex flex-col w-full">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative w-full h-[90vh] min-h-[640px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65 z-10" />
        <img
          src="/gallery/cake-lady-dress.jpeg"
          alt="Channah Cakes — Mombasa's favourite cake studio"
          className="absolute inset-0 w-full h-full object-cover scale-105"
          style={{ animation: "slowZoom 20s ease-in-out infinite alternate" }}
        />
        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <p className="uppercase tracking-[0.3em] text-white/70 text-xs md:text-sm font-medium mb-6">
            Mombasa's Favourite Cake Studio
          </p>
          <h1 className="font-serif text-6xl md:text-8xl font-bold mb-6 drop-shadow-md leading-tight">
            Decadence<br className="hidden md:block" /> in Every Bite
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 text-white/85 drop-shadow leading-relaxed">
            Custom birthday cakes, wedding creations, themed specials, and everyday indulgences — crafted with love in Mombasa.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-full px-10 text-base h-14 shadow-lg shadow-black/30"
              asChild
            >
              <Link href="/menu">Order Now</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/40 backdrop-blur-sm rounded-full px-10 text-base h-14"
              asChild
            >
              <Link href="/menu">Explore Menu</Link>
            </Button>
          </div>
        </div>
        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center pt-2">
            <div className="w-1 h-2 bg-white/70 rounded-full" />
          </div>
        </div>
      </section>

      {/* ── PROMOTIONS TICKER ───────────────────────────── */}
      {activePromotions.length > 0 && (
        <section className="bg-primary text-white py-4 overflow-hidden">
          <div className="container mx-auto px-4 flex items-center gap-8 overflow-x-auto scrollbar-none">
            {activePromotions.map((promo) => (
              <div key={promo.id} className="flex items-center gap-3 whitespace-nowrap shrink-0">
                {promo.discountPct && (
                  <span className="bg-white text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                    {promo.discountPct}% OFF
                  </span>
                )}
                <span className="font-medium text-sm">{promo.title}</span>
                {promo.description && (
                  <span className="text-white/70 text-sm">&mdash; {promo.description}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── WHY US ──────────────────────────────────────── */}
      <section className="py-20 bg-accent/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="uppercase tracking-widest text-xs text-primary font-semibold mb-3">Why Channah Cakes</p>
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">Baked Different</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_US.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 shadow-sm border border-border/30 hover:shadow-md transition-shadow">
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
      <section className="py-24 container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-14 gap-4">
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
            {featuredCakes?.slice(0, 3).map((cake) => (
              <Link key={cake.id} href={`/cake/${cake.id}`}>
                <Card className="group overflow-hidden border-none shadow-md hover:shadow-xl transition-all duration-300 rounded-2xl cursor-pointer bg-white">
                  <div className="aspect-[4/5] overflow-hidden relative">
                    <img
                      src={cake.imageUrl || "/gallery/cake-gold-butterfly.jpeg"}
                      alt={cake.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
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
                    <p className="text-secondary font-semibold tracking-wide">KES {cake.price.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── GALLERY — REAL WORK ──────────────────────────── */}
      <section className="py-20 bg-[#1a0d12]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <p className="uppercase tracking-widest text-xs text-primary font-semibold mb-3">Real Creations</p>
            <h2 className="font-serif text-4xl font-bold text-white">Our Work Speaks</h2>
            <p className="text-white/50 mt-3 text-sm max-w-md mx-auto">Every cake in this gallery was made right here in our Mombasa studio — no stock photos, just real joy.</p>
          </div>
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
            {GALLERY.map(({ src, label }) => (
              <div key={src} className="break-inside-avoid rounded-xl overflow-hidden group relative">
                <img
                  src={src}
                  alt={label}
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-end p-3 opacity-0 group-hover:opacity-100">
                  <span className="text-white text-xs font-semibold bg-primary/80 px-2 py-1 rounded-full">{label}</span>
                </div>
              </div>
            ))}
          </div>
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
            <img
              src="/gallery/cake-heels.jpeg"
              alt="Custom cake by Channah Cakes"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="bg-secondary flex items-center px-10 py-16 md:px-16">
            <div className="max-w-md">
              <p className="uppercase tracking-widest text-xs text-white/60 font-semibold mb-4">Our Story</p>
              <h2 className="font-serif text-4xl font-bold mb-6 text-white leading-snug">
                Crafted with Love<br />in Mombasa
              </h2>
              <p className="text-white/80 leading-relaxed mb-6">
                Channah Cakes was born from a simple belief: that a truly great cake can make any moment unforgettable. Nestled on the Kenyan coast, we pour our hearts into every creation — using fresh local ingredients, bold flavours, and the warmth of Mombasa hospitality.
              </p>
              <p className="text-white/80 leading-relaxed mb-8">
                From intimate birthday cakes to grand multi-tier wedding centrepieces, every order gets the same love and attention. We bake fresh, we deliver fast, and we never compromise on taste.
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
      <section className="py-24 bg-accent/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
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
              {popularCakes?.slice(0, 4).map((cake) => (
                <Link key={cake.id} href={`/cake/${cake.id}`}>
                  <Card className="group overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-xl cursor-pointer bg-white">
                    <div className="aspect-square overflow-hidden bg-muted">
                      <img
                        src={cake.imageUrl || "/gallery/cake-purple-butterfly.jpeg"}
                        alt={cake.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-base mb-1 truncate">{cake.name}</h3>
                      <p className="text-secondary text-sm font-semibold">KES {cake.price.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── TESTIMONIALS ────────────────────────────────── */}
      <section className="py-24 container mx-auto px-4">
        <div className="text-center mb-14">
          <p className="uppercase tracking-widest text-xs text-primary font-semibold mb-3">Happy Customers</p>
          <h2 className="font-serif text-4xl font-bold text-foreground">What Mombasa is Saying</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-white rounded-2xl p-8 shadow-sm border border-border/30 hover:shadow-md transition-shadow flex flex-col gap-4"
            >
              <StarRating rating={t.rating} />
              <p className="text-muted-foreground leading-relaxed text-sm flex-1">"{t.text}"</p>
              <div>
                <p className="font-bold text-foreground text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.location}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary py-20">
        <div className="absolute inset-0 opacity-15">
          <img src="/gallery/cake-heart.jpeg" alt="" className="w-full h-full object-cover" />
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
        @keyframes slowZoom {
          from { transform: scale(1.05); }
          to { transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
