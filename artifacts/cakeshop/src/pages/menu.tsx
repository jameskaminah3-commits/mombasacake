import { useState } from "react";
import { Link } from "wouter";
import { useListCakes, useListCategories } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

export default function Menu() {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories, isLoading: loadingCategories } = useListCategories();
  const { data: cakes, isLoading: loadingCakes } = useListCakes({
    categoryId: selectedCategory || undefined,
    search: search || undefined,
  });

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

          <div>
            <h3 className="font-bold uppercase tracking-wider text-sm mb-4 text-secondary">Categories</h3>
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
                  onClick={() => setSelectedCategory(null)}
                >
                  All Cakes
                </Button>
                {categories?.map((cat) => (
                  <Button
                    key={cat.id}
                    variant="ghost"
                    className={`justify-start font-medium rounded-lg ${selectedCategory === cat.id ? "bg-secondary/10 text-secondary hover:bg-secondary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
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
                      <img
                        src={cake.imageUrl || "/images/cake1.png"}
                        alt={cake.name}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${!cake.available ? 'opacity-50 grayscale' : ''}`}
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
                        <span className="text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">View &rarr;</span>
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
