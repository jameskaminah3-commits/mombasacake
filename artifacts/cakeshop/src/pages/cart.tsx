import { Link, useLocation } from "wouter";
import { cartLineKey, useCart } from "@/lib/cart-context";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Trash2 } from "lucide-react";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import { QuantityStepper } from "@/components/quantity-stepper";
import { formatKes } from "@/lib/utils";

export default function Cart() {
  const { items, updateQty, removeItem, total, itemCount } = useCart();
  const [, setLocation] = useLocation();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <ShoppingBag className="h-9 w-9 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-extrabold tracking-tight">Your cart is empty</h1>
        <p className="mb-8 text-sm text-muted-foreground">Looks like you haven't added any delicious treats to your cart yet.</p>
        <Button size="lg" className="rounded-full px-8" asChild>
          <Link href="/">Browse cakes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Your cart</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          + Add more
        </Link>
      </div>

      <ul className="mt-5 divide-y divide-border rounded-2xl border border-border">
        {items.map((item) => {
          const price = item.variantPrice ?? item.cake.price;
          const key = cartLineKey(item);
          return (
            <li key={key} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
              <Link href={`/cake/${item.cake.id}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24">
                <RevealImage
                  src={item.cake.imageUrl || DEFAULT_CAKE_IMAGE_URL}
                  alt={item.cake.name}
                  className="object-cover"
                  fallbackSrc={DEFAULT_CAKE_IMAGE_URL}
                  placeholderClassName="bg-muted"
                  timeoutMs={2500}
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.cake.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.variantLabel ? `${item.variantLabel} · ` : ""}
                      {formatKes(price)}
                    </p>
                    {item.flavour && <p className="mt-0.5 text-xs text-muted-foreground">Flavour: {item.flavour}</p>}
                    {item.secondFlavour && <p className="text-xs text-muted-foreground">Second flavour: {item.secondFlavour}</p>}
                    {item.message && <p className="mt-0.5 text-xs text-muted-foreground">Message: “{item.message}”</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(key)}
                    aria-label={`Remove ${item.cake.name} from cart`}
                    className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <QuantityStepper
                    size="sm"
                    quantity={item.quantity}
                    itemName={item.cake.name}
                    onDecrease={() => updateQty(key, item.quantity - 1)}
                    onIncrease={() => updateQty(key, item.quantity + 1)}
                  />
                  <p className="text-sm font-bold">{formatKes(price * item.quantity)}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-2 rounded-2xl bg-muted/60 p-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatKes(total)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Delivery</span>
          <span>Calculated at checkout</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
          <span>Total</span>
          <span>{formatKes(total)}</span>
        </div>
      </div>

      {/* Sticky on mobile, inline on larger screens */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 md:static md:mt-6 md:border-0 md:bg-transparent md:p-0">
        <Button size="lg" className="h-12 w-full rounded-full text-base font-semibold" onClick={() => setLocation("/checkout")}>
          Checkout · {formatKes(total)}
        </Button>
      </div>
    </div>
  );
}
