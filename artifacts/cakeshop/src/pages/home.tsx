import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useGetFeaturedCakes, useGetPopularCakes, useListPromotions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function Home() {
  const { data: featuredCakes, isLoading: loadingFeatured } = useGetFeaturedCakes();
  const { data: popularCakes, isLoading: loadingPopular } = useGetPopularCakes();
  const { data: promotions } = useListPromotions();

  const activePromotions = promotions?.filter((p) => p.active) || [];

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative w-full h-[80vh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black/40 z-10" />
        <img
          src="/images/hero.png"
          alt="Crème & Co. Patisserie"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 container mx-auto px-4 text-center text-white">
          <h1 className="font-serif text-5xl md:text-7xl font-bold mb-6 drop-shadow-md">
            Decadence in Every Bite
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 text-white/90 drop-shadow">
            Artisan celebration cakes, custom creations, and everyday indulgences crafted with passion in Nairobi.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-full px-8 text-base h-14" asChild>
              <Link href="/menu">Order Now</Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm rounded-full px-8 text-base h-14" asChild>
              <Link href="/menu">View Menu</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Promotions */}
      {activePromotions.length > 0 && (
        <section className="bg-secondary/10 py-12 border-y border-secondary/20">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activePromotions.map((promo) => (
                <div key={promo.id} className="bg-white p-6 rounded-2xl shadow-sm border border-secondary/20 flex flex-col items-center text-center">
                  {promo.discountPct && (
                    <span className="inline-block bg-primary text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wider">
                      {promo.discountPct}% OFF
                    </span>
                  )}
                  <h3 className="font-serif text-xl font-bold mb-2 text-foreground">{promo.title}</h3>
                  <p className="text-muted-foreground text-sm">{promo.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Cakes */}
      <section className="py-24 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl font-bold mb-4 text-foreground">Featured Creations</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our most celebrated flavors, perfectly balanced and beautifully presented for your special moments.
          </p>
        </div>

        {loadingFeatured ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => <CakeCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredCakes?.slice(0, 3).map((cake) => (
              <Link key={cake.id} href={`/cake/${cake.id}`}>
                <Card className="group overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 rounded-xl cursor-pointer bg-white">
                  <div className="aspect-[4/5] overflow-hidden relative">
                    <img
                      src={cake.imageUrl || "/images/cake1.png"}
                      alt={cake.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {cake.categoryName && (
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-medium rounded-full text-foreground">
                        {cake.categoryName}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-6 text-center">
                    <h3 className="font-serif text-xl font-bold mb-2 group-hover:text-primary transition-colors">{cake.name}</h3>
                    <p className="text-primary font-medium tracking-wide">KES {cake.price.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-12 text-center">
          <Button variant="outline" className="rounded-full px-8 border-secondary text-secondary-foreground hover:bg-secondary hover:text-white" asChild>
            <Link href="/menu">Explore All Cakes</Link>
          </Button>
        </div>
      </section>

      {/* Popular Cakes */}
      <section className="py-24 bg-card border-y border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="font-serif text-4xl font-bold mb-4 text-foreground">Crowd Favorites</h2>
              <p className="text-muted-foreground">The everyday indulgences our customers keep coming back for.</p>
            </div>
            <Link href="/menu" className="text-primary font-medium hover:underline whitespace-nowrap">
              View All &rarr;
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
                  <Card className="group overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-xl cursor-pointer bg-background">
                    <div className="aspect-square overflow-hidden bg-muted">
                      <img
                        src={cake.imageUrl || "/images/cake3.png"}
                        alt={cake.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-base mb-1 truncate">{cake.name}</h3>
                      <p className="text-muted-foreground text-sm font-medium">KES {cake.price.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      
      {/* Brand Section */}
      <section className="py-24 container mx-auto px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-serif text-3xl md:text-4xl font-bold mb-6 text-foreground">Baked with Love in Nairobi</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-8">
            Every creation at Crème & Co. is a labor of love. We source the finest ingredients—from rich Belgian cocoa to local, farm-fresh dairy—to craft cakes that taste as beautiful as they look.
          </p>
          <img src="/images/cake2.png" alt="Slice of cake" className="w-48 h-48 mx-auto rounded-full object-cover shadow-lg border-4 border-white" />
        </div>
      </section>
    </div>
  );
}
