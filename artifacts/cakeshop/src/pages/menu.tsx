import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useListCakes, useListCategories } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, Plus, Check, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import { useCart } from "@/lib/cart-context";

type SortOption = "default" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

const SLUG_TO_HERO: Record<string, string> = {
  kitchen: "kitchen",       "personal-care": "kitchen",
  bedroom: "kitchen",       "living-room": "kitchen",
  "small-appliances": "kitchen", lifestyle: "kitchen",
  appliances: "appliances", refrigerators: "appliances",
  "washing-machines": "appliances", "ac-fans": "appliances",
  cookers: "appliances",    microwaves: "appliances",
  fitness: "fitness",       treadmills: "fitness",
  "exercise-bikes": "fitness", weights: "fitness",
  benches: "fitness",       cardio: "fitness", gym: "fitness",
  electronics: "electronics", tvs: "electronics",
  sound: "electronics",     "smart-home": "electronics",
  "home-office": "electronics", accessories: "electronics",
};

const CATEGORY_HEROES: Record<string, {
  title: string; tagline: string; bg: string; fg: string; fgMuted: string; accent: string;
}> = {
  kitchen: {
    title: "Kitchen & Lifestyle",
    tagline: "Blenders, kettles, cookers and everything that makes your home shine.",
    bg: "#e8ede8", fg: "#013220", fgMuted: "rgba(1,50,32,0.55)", accent: "#013220",
  },
  appliances: {
    title: "Home Appliances",
    tagline: "Refrigerators, washing machines, ACs — premium brands at wholesale prices.",
    bg: "#013220", fg: "#ffffff", fgMuted: "rgba(255,255,255,0.55)", accent: "#D4AF37",
  },
  fitness: {
    title: "Fitness Equipment",
    tagline: "Build your home gym with treadmills, bikes, weights, and more.",
    bg: "#2d3748", fg: "#ffffff", fgMuted: "rgba(255,255,255,0.55)", accent: "#D4AF37",
  },
  electronics: {
    title: "Electronics",
    tagline: "Smart TVs, sound systems, home office tech — upgrade every room.",
    bg: "#111827", fg: "#ffffff", fgMuted: "rgba(255,255,255,0.55)", accent: "#D4AF37",
  },
};

const CATEGORY_PILLS = [
  { key: "kitchen",     label: "Kitchen & Lifestyle", href: "/menu?category=kitchen" },
  { key: "appliances",  label: "Appliances",          href: "/menu?category=appliances" },
  { key: "fitness",     label: "Fitness",             href: "/menu?category=fitness" },
  { key: "electronics", label: "Electronics",         href: "/menu?category=electronics" },
];

const SORT_LABELS: Record<SortOption, string> = {
  "default":    "Relevance",
  "price-asc":  "Price: Low to High",
  "price-desc": "Price: High to Low",
  "name-asc":   "Name: A – Z",
  "name-desc":  "Name: Z – A",
};

function getEffectivePrice(cake: { price: number; variants?: Array<{ price: number }> | null }): number {
  if (cake.variants && cake.variants.length > 0) {
    return Math.min(...cake.variants.map((v) => v.price));
  }
  return cake.price || 0;
}

export default function Menu() {
  const [location] = useLocation();

  const urlParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [location],
  );
  const urlSearch   = urlParams.get("search") ?? "";
  const urlCategory = urlParams.get("category") ?? "";

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search,    setSearch]    = useState(urlSearch);
  const [minPrice,  setMinPrice]  = useState("");
  const [maxPrice,  setMaxPrice]  = useState("");
  const [inStock,   setInStock]   = useState(false);
  const [sortBy,    setSortBy]    = useState<SortOption>("default");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen,    setSortOpen]    = useState(false);
  const [catOpen,     setCatOpen]     = useState(false);
  const [addedIds,    setAddedIds]    = useState<Set<number>>(new Set());

  const { addItem, items } = useCart();
  const { data: categories, isLoading: loadingCategories } = useListCategories();
  const { data: cakes, isLoading: loadingCakes } = useListCakes({
    categoryId: selectedCategory || undefined,
    search: search || undefined,
  });

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);

  useEffect(() => {
    if (!categories || !urlCategory) {
      if (!urlCategory) setSelectedCategory(null);
      return;
    }
    const slug    = urlCategory.toLowerCase().replace(/-/g, " ");
    const matched = categories.find((c) => {
      const name = c.name.toLowerCase();
      return name === slug || name.includes(slug) || slug.includes(name.split(" ")[0]);
    });
    setSelectedCategory(matched?.id ?? null);
  }, [categories, urlCategory]);

  const processedCakes = useMemo(() => {
    if (!cakes) return [];
    let result = [...cakes];

    if (inStock)   result = result.filter((c) => c.available);
    if (minPrice)  result = result.filter((c) => getEffectivePrice(c) >= Number(minPrice));
    if (maxPrice && Number(maxPrice) > 0) result = result.filter((c) => getEffectivePrice(c) <= Number(maxPrice));

    switch (sortBy) {
      case "price-asc":  result.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b)); break;
      case "price-desc": result.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a)); break;
      case "name-asc":   result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name-desc":  result.sort((a, b) => b.name.localeCompare(a.name)); break;
    }
    return result;
  }, [cakes, inStock, minPrice, maxPrice, sortBy]);

  const handleQuickAdd = (e: React.MouseEvent, cake: NonNullable<typeof cakes>[number]) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(cake, 1);
    setAddedIds((prev) => new Set([...prev, cake.id]));
    setTimeout(() => setAddedIds((prev) => { const n = new Set(prev); n.delete(cake.id); return n; }), 1500);
  };

  const clearFilters = () => {
    setSelectedCategory(null);
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setSortBy("default");
  };

  const hasActiveFilters = selectedCategory !== null || search || minPrice || maxPrice || inStock || sortBy !== "default";
  const selectedCatName  = categories?.find((c) => c.id === selectedCategory)?.name;

  const heroKey = SLUG_TO_HERO[urlCategory.toLowerCase()] ?? null;
  const hero    = heroKey ? CATEGORY_HEROES[heroKey] : null;

  return (
    <div className="bg-background min-h-screen">
      {/* Page hero — dynamic per category */}
      {hero ? (
        <div className="py-12 sm:py-16 transition-colors duration-300" style={{ backgroundColor: hero.bg }}>
          <div className="container mx-auto px-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] mb-3" style={{ color: hero.accent, opacity: 0.7 }}>
              HAPPYFINE_KE Wholesalers
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold mb-3" style={{ color: hero.fg }}>
              {hero.title}
            </h1>
            <p className="text-base max-w-lg mx-auto mb-7" style={{ color: hero.fgMuted }}>
              {hero.tagline}
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {CATEGORY_PILLS.map((pill) => (
                <Link
                  key={pill.key}
                  href={pill.href}
                  className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-200 ${
                    heroKey === pill.key
                      ? "bg-white text-foreground border-white shadow-sm"
                      : "border-current hover:bg-white/10"
                  }`}
                  style={{ color: heroKey === pill.key ? undefined : hero.fgMuted }}
                >
                  {pill.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#F7F7F7] py-10 sm:py-12">
          <div className="container mx-auto px-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-secondary/50 mb-2">
              HAPPYFINE_KE Wholesalers
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3">
              All Products
            </h1>
            <p className="text-muted-foreground text-base max-w-lg mx-auto mb-7">
              Premium home appliances, kitchen essentials, fitness equipment — wholesale prices in Mombasa.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {CATEGORY_PILLS.map((pill) => (
                <Link
                  key={pill.key}
                  href={pill.href}
                  className="text-xs font-semibold px-4 py-2 rounded-full border border-secondary/25 text-secondary hover:bg-secondary hover:text-white hover:border-secondary transition-all duration-200"
                >
                  {pill.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-10">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder="Search products..."
                className="h-10 pl-9 pr-4 border border-border bg-white text-sm focus:outline-none focus:border-secondary rounded-none w-56"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Mobile filter toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="md:hidden flex items-center gap-2 h-10 px-4 border border-border bg-white text-sm font-medium hover:border-secondary transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </button>

            {/* Active filter chips */}
            {selectedCatName && (
              <span className="flex items-center gap-1.5 bg-secondary text-white text-xs font-semibold px-3 py-1.5">
                {selectedCatName}
                <button onClick={() => setSelectedCategory(null)} aria-label="Remove category filter">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-primary underline transition-colors">
                Clear all
              </button>
            )}
          </div>

          {/* Right: results count + sort */}
          <div className="flex items-center gap-3 ml-auto">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {loadingCakes ? "Loading…" : `${processedCakes.length} product${processedCakes.length !== 1 ? "s" : ""}`}
            </span>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(!sortOpen)}
                className="flex items-center gap-2 h-10 px-4 border border-border bg-white text-sm font-medium hover:border-secondary transition-colors whitespace-nowrap"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                {SORT_LABELS[sortBy]}
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${sortOpen ? "rotate-180" : ""}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-border shadow-lg z-30">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => { setSortBy(key); setSortOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        sortBy === key ? "bg-primary/10 text-primary font-semibold" : "hover:bg-gray-50 text-foreground"
                      }`}
                    >
                      {SORT_LABELS[key]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-8 items-start">

          {/* ── SIDEBAR FILTERS ─────────────────────────────── */}
          <aside className={`w-64 shrink-0 space-y-6 ${filtersOpen ? "block" : "hidden md:block"} sticky top-[128px]`}>

            {/* Categories */}
            <div className="border border-border bg-white">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-widest"
                onClick={() => setCatOpen(!catOpen)}
              >
                Categories
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${catOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`${catOpen ? "block" : "hidden"} border-t border-border`}>
                {loadingCategories ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-3/4" />
                    <Skeleton className="h-7 w-5/6" />
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-none transition-colors ${
                        selectedCategory === null ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-gray-50"
                      }`}
                    >
                      All Products
                    </button>
                    {categories?.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full text-left px-3 py-2 text-sm rounded-none transition-colors ${
                          selectedCategory === cat.id ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-gray-50"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Price range */}
            <div className="border border-border bg-white">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-bold uppercase tracking-widest">Price Range</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Min (KES)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      className="w-full h-9 border border-border px-3 text-sm focus:outline-none focus:border-secondary bg-white rounded-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1 block">Max (KES)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Any"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      className="w-full h-9 border border-border px-3 text-sm focus:outline-none focus:border-secondary bg-white rounded-none"
                    />
                  </div>
                </div>
                {(minPrice || maxPrice) && (
                  <button
                    onClick={() => { setMinPrice(""); setMaxPrice(""); }}
                    className="text-xs text-muted-foreground hover:text-primary underline transition-colors"
                  >
                    Clear price filter
                  </button>
                )}
              </div>
            </div>

            {/* Availability */}
            <div className="border border-border bg-white">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-bold uppercase tracking-widest">Availability</p>
              </div>
              <div className="p-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setInStock(!inStock)}
                    className={`w-5 h-5 border-2 flex items-center justify-center transition-colors cursor-pointer ${
                      inStock ? "border-primary bg-primary" : "border-border group-hover:border-primary"
                    }`}
                  >
                    {inStock && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-foreground select-none" onClick={() => setInStock(!inStock)}>
                    In Stock Only
                  </span>
                </label>
              </div>
            </div>

            {/* Clear all */}
            {hasActiveFilters && (
              <Button variant="outline" className="w-full rounded-none border-border" onClick={clearFilters}>
                Clear All Filters
              </Button>
            )}
          </aside>

          {/* ── PRODUCT GRID ────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            {loadingCakes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="overflow-hidden border border-border bg-white">
                    <Skeleton className="h-[260px] w-full" />
                    <div className="p-4">
                      <Skeleton className="h-5 w-2/3 mb-2" />
                      <Skeleton className="h-4 w-1/3 mb-4" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : processedCakes.length === 0 ? (
              <div className="text-center py-24 bg-white border border-border">
                <Search className="w-10 h-10 mx-auto mb-4 text-border" />
                <h3 className="text-xl font-bold mb-2">No products found</h3>
                <p className="text-muted-foreground text-sm mb-6">Try adjusting your filters or search term.</p>
                <Button variant="outline" className="rounded-none" onClick={clearFilters}>
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {processedCakes.map((cake) => (
                    <Link key={cake.id} href={`/cake/${cake.id}`}>
                      <div className="group overflow-hidden border border-border bg-white hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col">

                        {/* Image */}
                        <div className="aspect-square overflow-hidden bg-gray-50 relative">
                          <RevealImage
                            src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                            alt={cake.name}
                            className={`object-cover group-hover:scale-105 transition-transform duration-500 ${!cake.available ? "opacity-50 grayscale" : ""}`}
                            fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                            timeoutMs={2500}
                          />
                          {!cake.available && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="bg-black/75 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider">
                                Out of Stock
                              </span>
                            </div>
                          )}
                          {cake.available && cake.categoryName && (
                            <span className="absolute top-3 left-3 bg-secondary text-white text-[9px] font-bold uppercase tracking-[0.18em] px-2.5 py-1">
                              {cake.categoryName}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="p-4 flex-1 flex flex-col">
                          <h3 className="font-semibold text-sm mb-1 leading-snug group-hover:text-primary transition-colors line-clamp-2 flex-1">
                            {cake.name}
                          </h3>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <p className="font-bold text-primary text-sm">
                              {cake.variants && cake.variants.length > 0
                                ? `From KES ${Math.min(...cake.variants.map((v) => v.price)).toLocaleString()}`
                                : `KES ${cake.price.toLocaleString()}`}
                            </p>
                            {cake.available && (
                              cake.variants && cake.variants.length > 0 ? (
                                <Link
                                  href={`/cake/${cake.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-semibold px-3 py-1.5 bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all duration-200 whitespace-nowrap"
                                >
                                  View Options
                                </Link>
                              ) : (
                                <button
                                  onClick={(e) => handleQuickAdd(e, cake)}
                                  aria-label={`Add ${cake.name} to cart`}
                                  className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 transition-all duration-200 whitespace-nowrap ${
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
                                    <><Plus className="w-3 h-3" /> Add to Cart</>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <p className="mt-8 text-center text-sm text-muted-foreground">
                  Showing {processedCakes.length} product{processedCakes.length !== 1 ? "s" : ""}
                  {selectedCatName ? ` in ${selectedCatName}` : ""}
                </p>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
