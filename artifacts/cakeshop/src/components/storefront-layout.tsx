import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useListCakes, useListCategories } from "@workspace/api-client-react";
import { Clock, Menu, Phone, Search, ShoppingBag } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useCart } from "@/lib/cart-context";
import { DEFAULT_CAKE_IMAGE_URL, DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";
import { cakePriceLabel, useCakeOptions } from "@/lib/cake-options";
import { captureReferralCodeFromUrl, useCustomerSession, useEmailLoginAvailable } from "@/lib/customer";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  STORE_HOURS,
  STORE_NAME,
  STORE_PHONE,
  STORE_PHONE_DISPLAY,
  STORE_SOCIALS,
  WHATSAPP_ORDER_URL,
  formatHoursRange,
} from "@/lib/store-info";
import { categorySectionId, scrollToSection } from "@/lib/store-sections";
import { cn, formatKes } from "@/lib/utils";

// Pages that have their own checkout flow, so the floating "View cart" bar would only get in the way.
const CART_BAR_HIDDEN_PREFIXES = ["/cart", "/checkout", "/order", "/cake/"];

const iconButtonClass = "relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-muted";

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { itemCount, total } = useCart();
  const [location, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const customerSession = useCustomerSession();
  const loginAvailable = useEmailLoginAvailable();
  const { data: categories } = useListCategories();

  // A friend's shared link (…/?ref=CODE) fills their code in at checkout.
  useEffect(() => captureReferralCodeFromUrl(), []);

  const isShopPage = location === "/";
  const showCartBar = itemCount > 0 && !CART_BAR_HIDDEN_PREFIXES.some((prefix) => location.startsWith(prefix));
  // The product and cart pages pin their own action bar to the bottom of the screen on mobile.
  const pageHasMobileActionBar = location.startsWith("/cake/") || (location === "/cart" && itemCount > 0);

  // Category links work from any page: scroll on the shop page, otherwise open it at that category.
  const goToCategory = (categoryId: number) => {
    const sectionId = categorySectionId(categoryId);
    if (isShopPage) {
      scrollToSection(sectionId);
    } else {
      setLocation(`/#${sectionId}`);
    }
  };

  const categoryLinks = (onSelect: (categoryId: number) => void) =>
    (categories ?? []).map((category) => (
      <li key={category.id}>
        <button
          type="button"
          onClick={() => onSelect(category.id)}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
        >
          {category.name}
        </button>
      </li>
    ));

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background">
        <div className="flex h-14 items-center gap-1 px-2 sm:px-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button type="button" aria-label="Open menu" className={iconButtonClass}>
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[85vw] max-w-xs flex-col gap-0 overflow-y-auto p-0">
              <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-border bg-white">
                  <RevealImage src={DEFAULT_LOGO_IMAGE_URL} alt="" className="object-contain p-0.5" placeholderClassName="bg-transparent" timeoutMs={2000} />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-base font-bold">{STORE_NAME}</SheetTitle>
                  <SheetDescription className="text-xs">Custom cakes in Mombasa</SheetDescription>
                </div>
              </div>
              <nav className="flex-1 px-2 py-3" aria-label="Shop menu">
                <SheetClose asChild>
                  <Link href="/" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
                    Shop
                  </Link>
                </SheetClose>
                <ul className="mt-1">
                  {categoryLinks((categoryId) => {
                    setMenuOpen(false);
                    // Wait for the drawer to close (it locks page scrolling while open).
                    window.setTimeout(() => goToCategory(categoryId), 320);
                  })}
                </ul>
                <SheetClose asChild>
                  <Link href="/orders" className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
                    My orders
                  </Link>
                </SheetClose>
                {(customerSession || loginAvailable) && (
                  <SheetClose asChild>
                    <Link href="/account" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
                      {customerSession ? "My account" : "Sign in"}
                    </Link>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Link href="/blog" className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
                    Blog
                  </Link>
                </SheetClose>
              </nav>
              <div className="space-y-3 border-t border-border px-5 py-4 text-sm">
                <a href={WHATSAPP_ORDER_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-semibold text-[#1fa855]">
                  <SiWhatsapp className="h-4 w-4" /> WhatsApp us
                </a>
                <a href={`tel:${STORE_PHONE}`} className="flex items-center gap-2 text-foreground/80">
                  <Phone className="h-4 w-4" /> {STORE_PHONE_DISPLAY}
                </a>
                <div className="flex gap-2 text-foreground/80">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                  <ul className="space-y-0.5">
                    {STORE_HOURS.map((entry) => (
                      <li key={entry.days}>
                        {entry.days}: {formatHoursRange(entry)}
                      </li>
                    ))}
                  </ul>
                </div>
                <SheetClose asChild>
                  <Link href="/login" className="block text-xs text-muted-foreground">
                    Staff login
                  </Link>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>

          {location !== "/" && (
            <Link href="/" className="truncate text-[15px] font-bold tracking-tight">
              {STORE_NAME}
            </Link>
          )}

          <div className="ml-auto flex items-center">
            <SearchSheet />
            <Link
              href="/cart"
              aria-label={itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Cart"}
              className={iconButtonClass}
            >
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* On wide screens the category list stays open beside the shop, like the menu drawer on phones. */}
      {isShopPage && (
        <aside className="fixed bottom-0 left-0 top-14 z-30 hidden w-52 overflow-y-auto border-r border-border/70 px-2 py-4 xl:block" aria-label="Category menu">
          <Link href="/" className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-muted">
            Shop
          </Link>
          <ul>{categoryLinks(goToCategory)}</ul>
        </aside>
      )}

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className={cn("border-t border-border", showCartBar ? "pb-24" : pageHasMobileActionBar && "pb-24 md:pb-0")}>
        <div className="mx-auto max-w-2xl px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2">
            {STORE_SOCIALS.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">&copy; {new Date().getFullYear()} {STORE_NAME}</p>
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <Link href="/blog" className="hover:text-foreground">Blog</Link>
            <Link href="/login" className="hover:text-foreground">Staff login</Link>
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
    </div>
  );
}

function SearchSheet() {
  const [query, setQuery] = useState("");
  const { data: cakes } = useListCakes();
  const cakeOptions = useCakeOptions();
  const term = query.trim().toLowerCase();
  const results = term
    ? (cakes ?? [])
        .filter((cake) => [cake.name, cake.description, cake.categoryName].some((field) => field?.toLowerCase().includes(term)))
        .slice(0, 20)
    : [];

  return (
    <Sheet onOpenChange={(open) => !open && setQuery("")}>
      <SheetTrigger asChild>
        <button type="button" aria-label="Search cakes" className={iconButtonClass}>
          <Search className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="top" className="max-h-[100dvh] overflow-y-auto px-4 pb-6 pt-4">
        <SheetTitle className="sr-only">Search cakes</SheetTitle>
        <SheetDescription className="sr-only">Type a cake name, flavour or occasion.</SheetDescription>
        <div className="relative mx-auto mr-8 max-w-2xl sm:mx-auto">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cakes"
            aria-label="Search cakes"
            autoFocus
            className="h-11 w-full rounded-full bg-muted pl-10 pr-4 text-base outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mx-auto mt-3 max-w-2xl">
          {term && results.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">No cakes match “{query.trim()}”.</p>
          )}
          <ul className="divide-y divide-border">
            {results.map((cake) => (
              <li key={cake.id}>
                <SheetClose asChild>
                  <Link href={`/cake/${cake.id}`} className="flex items-center gap-3 py-2.5">
                    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <RevealImage src={cake.imageUrl || DEFAULT_CAKE_IMAGE_URL} alt="" className="object-cover" fallbackSrc={DEFAULT_CAKE_IMAGE_URL} placeholderClassName="bg-muted" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{cake.name}</span>
                      <span className="block text-xs text-muted-foreground">{cakePriceLabel(cake, cakeOptions)}</span>
                    </span>
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
