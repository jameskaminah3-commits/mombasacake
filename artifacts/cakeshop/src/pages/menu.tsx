import { useState } from "react";
import { Link } from "wouter";
import { useListCakes, useListCategories } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, Plus, Check } from "lucide-react";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import { useCart } from "@/lib/cart-context";

export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());

  const { addItem, items } = useCart();

  const { data: categories, isLoading: loadingCategories } = useListCategories();
  const { data: cakes, isLoading: loadingCakes } = useListCakes({
    categoryId: selectedCategory || undefined,
    search: search || undefined,
  });

  const handleQuickAdd = (e: React.MouseEvent, cake: NonNullable<typeof cakes>[number]) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(cake, 1);
    setAddedIds((prev) => new Set([...prev, cake.id]));
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(cake.id);
        return next;
      });
    }, 1500);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">Our Menu</h1>
        <p className="text-muted-foreground text-lg">
          Browse our collection of artisan cakes. Each piece is crafted to perfection.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-8 sticky top-24">
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cakes..."
                className="pl-9 bg-card border-border rounded-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden md:bg-transparent md:border-0 md:rounded-none md:backdrop-blur-none">
            <button
              className="w-full flex items-center justify-between px-4 py-3 md:px-0 md:py-0 md:pointer-events-none"
              onClick={() => setCategoriesOpen((o) => !o)}
              aria-expanded={categoriesOpen}
            >
              <h3 className="font-bold uppercase tracking-wider text-sm text-secondary">Categories</h3>
              <ChevronDown
                className={`h-4 w-4 text-secondary transition-transform duration-300 md:hidden ${categoriesOpen ? "rotate-180" : ""}`}
              />
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out md:grid-rows-[1fr] ${categoriesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 pt-1 md:px-0 md:pb-0 md:pt-0 md:mt-4">
                  {loadingCategories ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-3/4" />
                      <Skeleton className="h-8 w-5/6" />
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-1">
                      <Button
                        variant="ghost"
                        className={`justify-start font-medium rounded-lg ${selectedCategory === null ? "bg-secondary/10 text-secondary hover:bg-secondary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                        onClick={() => { setSelectedCategory(null); setCategoriesOpen(false); }}
                      >
                        All Cakes
                      </Button>
                      {categories?.map((cat) => (
                        <Button
                          key={cat.id}
                          variant="ghost"
                          className={`justify-start font-medium rounded-lg ${selectedCategory === cat.id ? "bg-secondary/10 text-secondary hover:bg-secondary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                          onClick={() => { setSelectedCategory(cat.id); setCategoriesOpen(false); }}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {selectedCategory !== null && (
              <div className="px-4 pb-3 md:hidden">
                <span className="inline-flex items-center gap-1 text-xs font-medium bg-secondary/10 text-secondary px-3 py-1 rounded-full">
                  {categories?.find((c) => c.id === selectedCategory)?.name}
                  <button
                    className="ml-1 hover:text-secondary/70"
                    onClick={() => setSelectedCategory(null)}
                    aria-label="Clear category filter"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full">
          {loadingCakes ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} className="overflow-hidden border-none shadow-sm rounded-xl">
                  <Skeleton className="h-[250px] w-full" />
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-2/3 mb-2" />
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : cakes?.length === 0 ? (
            <div className="text-center py-24 bg-card rounded-2xl border border-border">
              <h3 className="text-xl font-bold mb-2">No cakes found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search term.</p>
              <Button
                variant="outline"
                className="mt-6 rounded-full"
                onClick={() => {
                  setSelectedCategory(null);
                  setSearch("");
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {cakes?.map((cake) => (
                <Link key={cake.id} href={`/cake/${cake.id}`}>
                  <Card className="group overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 rounded-xl cursor-pointer bg-white h-full flex flex-col">
                    <div className="aspect-[4/3] overflow-hidden bg-muted relative">
                      <RevealImage
                        src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                        alt={cake.name}
                        className={`object-cover group-hover:scale-105 transition-transform duration-500 ${!cake.available ? "opacity-50 grayscale" : ""}`}
                        fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                        timeoutMs={2500}
                      />
                      {!cake.available && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="bg-black/80 text-white font-bold px-4 py-2 rounded-full uppercase tracking-wider text-sm">
                            Sold Out
                          </span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-5 flex-1 flex flex-col">
                      <div className="mb-auto">
                        {cake.categoryName && (
                          <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-1">
                            {cake.categoryName}
                          </p>
                        )}
                        <h3 className="font-serif text-lg font-bold mb-1 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                          {cake.name}
                        </h3>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <p className="font-medium text-foreground">KES {cake.price.toLocaleString()}</p>
                        {cake.available ? (
                          <button
                            onClick={(e) => handleQuickAdd(e, cake)}
                            aria-label={`Add ${cake.name} to cart`}
                            className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
                              addedIds.has(cake.id)
                                ? "bg-green-100 text-green-700"
                                : items.find((i) => i.cake.id === cake.id)
                                ? "bg-primary text-white"
                                : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
                            }`}
                          >
                            {addedIds.has(cake.id) ? (
                              <><Check className="w-3 h-3" /> Added</>
                            ) : items.find((i) => i.cake.id === cake.id) ? (
                              <>{items.find((i) => i.cake.id === cake.id)!.quantity} in cart</>
                            ) : (
                              <><Plus className="w-3 h-3" /> Add</>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
