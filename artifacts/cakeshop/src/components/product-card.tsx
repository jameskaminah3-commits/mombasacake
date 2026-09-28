import { Link } from "wouter";
import { Plus } from "lucide-react";
import type { Cake } from "@workspace/api-client-react";
import { RevealImage } from "@/components/reveal-image";
import { QuantityStepper } from "@/components/quantity-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/lib/cart-context";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { cn, formatKes } from "@/lib/utils";

const addButtonClass =
  "relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-md ring-1 ring-black/5 transition-transform after:absolute after:-inset-1 hover:scale-105 active:scale-95";

export function cakePriceLabel(cake: Cake) {
  if (cake.variants && cake.variants.length > 0) {
    return `From ${formatKes(Math.min(...cake.variants.map((variant) => variant.price)))}`;
  }
  return formatKes(cake.price);
}

export function ProductCard({ cake, className }: { cake: Cake; className?: string }) {
  const { items, addItem, updateQty } = useCart();
  const href = `/cake/${cake.id}`;
  const hasVariants = !!cake.variants && cake.variants.length > 0;
  // Cakes with sizes are chosen on the product page; the rest can be added straight from the card.
  const cartItem = hasVariants ? undefined : items.find((item) => item.cake.id === cake.id && !item.variantLabel);

  let control: React.ReactNode = null;
  if (cake.available) {
    if (hasVariants) {
      control = (
        <Link href={href} aria-label={`Choose a size for ${cake.name}`} className={addButtonClass}>
          <Plus className="h-5 w-5" />
        </Link>
      );
    } else if (cartItem) {
      control = (
        <QuantityStepper
          size="sm"
          variant="filled"
          quantity={cartItem.quantity}
          itemName={cake.name}
          onDecrease={() => updateQty(cake.id, cartItem.quantity - 1)}
          onIncrease={() => updateQty(cake.id, cartItem.quantity + 1)}
          className="shadow-md"
        />
      );
    } else {
      control = (
        <button type="button" onClick={() => addItem(cake, 1)} aria-label={`Add ${cake.name} to cart`} className={addButtonClass}>
          <Plus className="h-5 w-5" />
        </button>
      );
    }
  }

  return (
    <div className={cn("group flex flex-col", className)}>
      <div className="relative">
        <Link href={href} className="relative block aspect-square overflow-hidden rounded-xl bg-muted">
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
        </Link>
        {control && <div className="absolute bottom-2 right-2">{control}</div>}
      </div>
      <Link href={href} className="mt-2 line-clamp-2 text-sm font-semibold leading-snug transition-colors hover:text-primary">
        {cake.name}
      </Link>
      <p className="mt-1 text-sm font-bold">{cakePriceLabel(cake)}</p>
    </div>
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
