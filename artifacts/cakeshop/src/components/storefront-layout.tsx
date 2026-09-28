import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { ShoppingBag } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import {
  STORE_EMAIL,
  STORE_HOURS,
  STORE_LOCATION,
  STORE_NAME,
  STORE_PHONE,
  STORE_PHONE_DISPLAY,
  STORE_SOCIALS,
  WHATSAPP_ORDER_URL,
  WHATSAPP_URL,
} from "@/lib/store-info";
import { cn, formatKes } from "@/lib/utils";

// Pages that have their own checkout flow, so the floating "View cart" bar would only get in the way.
const CART_BAR_HIDDEN_PREFIXES = ["/cart", "/checkout", "/order", "/cake/"];

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { itemCount, total } = useCart();
  const [location] = useLocation();

  const showCartBar = itemCount > 0 && !CART_BAR_HIDDEN_PREFIXES.some((prefix) => location.startsWith(prefix));
  // The product and cart pages pin their own action bar to the bottom of the screen on mobile.
  const pageHasMobileActionBar = location.startsWith("/cake/") || (location === "/cart" && itemCount > 0);
  // Hide the floating WhatsApp button while a page's own WhatsApp button is on screen (the shop header),
  // and on checkout so the form stays clear; the footer still links to WhatsApp.
  const [inlineWhatsAppVisible, setInlineWhatsAppVisible] = useState(false);
  useEffect(() => {
    const inlineButton = document.querySelector("[data-inline-whatsapp]");
    if (!inlineButton) {
      setInlineWhatsAppVisible(false);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInlineWhatsAppVisible(entry.isIntersecting));
    observer.observe(inlineButton);
    return () => observer.disconnect();
  }, [location]);
  const showWhatsAppButton = !location.startsWith("/checkout") && !inlineWhatsAppVisible;

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted",
        location === href ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Channah Cakes home">
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border bg-white">
              <RevealImage
                src={DEFAULT_LOGO_IMAGE_URL}
                alt=""
                className="object-contain p-0.5"
                eager
                placeholderClassName="bg-transparent"
                timeoutMs={2000}
              />
            </span>
            <span className="truncate text-[15px] font-bold tracking-tight">Channah Cakes</span>
          </Link>

          <nav className="flex items-center gap-1">
            <div className="hidden items-center gap-1 sm:flex">
              {navLink("/", "Shop")}
              {navLink("/blog", "Blog")}
            </div>
            <Link
              href="/cart"
              aria-label={itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Cart"}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted"
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer
        className={cn(
          "border-t border-border bg-muted/50",
          showCartBar ? "pb-24" : pageHasMobileActionBar && "pb-24 md:pb-0",
        )}
      >
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-white">
                  <RevealImage
                    src={DEFAULT_LOGO_IMAGE_URL}
                    alt=""
                    className="object-contain p-0.5"
                    placeholderClassName="bg-transparent"
                    timeoutMs={2000}
                  />
                </span>
                <p className="font-bold">{STORE_NAME}</p>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                Premium artisan celebration cakes, custom creations, and everyday indulgences — handcrafted in Mombasa, Kenya.
              </p>
              <div className="mt-4 flex items-center gap-2">
                {STORE_SOCIALS.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/80 transition-colors hover:border-primary hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Opening hours</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {STORE_HOURS.map(({ days, hours }) => (
                  <li key={days} className="flex justify-between gap-4 sm:max-w-[14rem]">
                    <span>{days}</span>
                    <span className="text-muted-foreground">{hours}</span>
                  </li>
                ))}
                <li className="pt-1 text-muted-foreground">{STORE_LOCATION}</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>
                  <a href={`tel:${STORE_PHONE}`} className="transition-colors hover:text-primary">
                    {STORE_PHONE_DISPLAY}
                  </a>
                </li>
                <li>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-primary">
                    WhatsApp us
                  </a>
                </li>
                <li>
                  <a href={`mailto:${STORE_EMAIL}`} className="transition-colors hover:text-primary">
                    {STORE_EMAIL}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>&copy; {new Date().getFullYear()} Channah Cakes. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="/blog" className="transition-colors hover:text-foreground">Blog</Link>
              <Link href="/login" className="transition-colors hover:text-foreground">Staff login</Link>
            </div>
          </div>
        </div>
      </footer>

      {showCartBar && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/cart"
            className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground shadow-xl shadow-primary/25 transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-sm font-bold">
                {itemCount}
              </span>
              <span className="font-semibold">View cart</span>
            </span>
            <span className="font-bold">{formatKes(total)}</span>
          </Link>
        </div>
      )}

      {showWhatsAppButton && (
        <a
          href={WHATSAPP_ORDER_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          className={cn(
            // Bottom-left so it never covers the "+" buttons on the right of product cards.
            "fixed left-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-lg shadow-black/15 transition-all hover:bg-[#1fb958] active:scale-95 sm:py-3 sm:pl-3.5 sm:pr-5",
            showCartBar ? "bottom-24" : pageHasMobileActionBar ? "bottom-24 md:bottom-5" : "bottom-5",
          )}
        >
          <SiWhatsapp className="h-5 w-5 shrink-0" />
          <span className="hidden text-sm font-semibold sm:inline">Chat with us</span>
        </a>
      )}
    </div>
  );
}
