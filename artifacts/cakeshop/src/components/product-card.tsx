import { Link } from "wouter";
import type { Cake } from "@workspace/api-client-react";
import { RevealImage } from "@/components/reveal-image";
import { Skeleton } from "@/components/ui/skeleton";
import { cakePriceLabel, useCakeOptions } from "@/lib/cake-options";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { cn } from "@/lib/utils";

// Cakes need a size, flavour and message, so cards open the cake page rather than adding straight to the cart.
export function ProductCard({ cake, className }: { cake: Cake; className?: string }) {
  const cakeOptions = useCakeOptions();
  return (
    <Link href={`/cake/${cake.id}`} className={cn("group block", className)}>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted">
        <RevealImage
          src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
          alt={cake.name}
          className={cn(
            "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
            !cake.available && "opacity-60 grayscale",
          )}
          fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
          placeholderClassName="bg-muted"
          timeoutMs={2500}
        />
        {!cake.available && (
          <span className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2.5 py-1 text-[11px] font-semibold text-background">
            Sold out
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-primary">
        {cake.name}
      </p>
      <p className="mt-0.5 text-sm text-foreground/80">{cakePriceLabel(cake, cakeOptions)}</p>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/3" />
    </div>
  );
}
