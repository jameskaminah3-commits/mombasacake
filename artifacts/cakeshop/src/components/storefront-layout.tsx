import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { ShoppingBag, Menu, X, Search, ChevronDown, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube, SiWhatsapp } from "react-icons/si";
import { DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";

const SOCIALS = [
  { icon: SiFacebook, href: "https://www.facebook.com/happyfineke", label: "Facebook" },
  { icon: SiInstagram, href: "https://instagram.com/happyfineke", label: "Instagram" },
  { icon: SiTiktok, href: "https://tiktok.com/@happyfineke", label: "TikTok" },
  { icon: SiYoutube, href: "https://youtube.com/@happyfineke", label: "YouTube" },
  { icon: SiWhatsapp, href: "https://wa.me/254700000000", label: "WhatsApp" },
];

const SHOP_CATEGORIES = [
  { label: "Kitchen & Utensils", href: "/menu?category=kitchen" },
  { label: "Home Appliances", href: "/menu?category=appliances" },
  { label: "Gym & Fitness", href: "/menu?category=gym" },
  { label: "Personal Care", href: "/menu?category=personal-care" },
  { label: "Bedroom", href: "/menu?category=bedroom" },
  { label: "Living Room", href: "/menu?category=living-room" },
  { label: "Outdoor & Garden", href: "/menu?category=outdoor" },
];

function AnnouncementBar() {
  return (
    <div className="w-full bg-primary text-primary-foreground py-2 px-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em]">
      Free delivery on orders over KES 5,000 · Mombasa &amp; Surroundings
    </div>
  );
}

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { itemCount, total } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [location] = useLocation();

  const closeMenu = () => {
    setIsMobileMenuOpen(false);
    setIsShopOpen(false);
  };

  const isActive = (href: string) => location === href;

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans">
      <AnnouncementBar />

      {/* ── HEADER ─── */}
      <header className="sticky top-0 z-50 w-full bg-secondary shadow-lg shadow-black/20">
        <div className="container mx-auto px-4 h-[68px] flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" onClick={closeMenu} aria-label="HAPPYFINE_KE home" className="shrink-0">
            <div className="h-12 w-24 sm:h-14 sm:w-28">
              <RevealImage
                src={DEFAULT_LOGO_IMAGE_URL}
                alt="HAPPYFINE_KE"
                className="object-contain"
                eager
                placeholderClassName="bg-transparent"
                timeoutMs={2000}
              />
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium flex-1 justify-center">
            <Link
              href="/"
              className={`px-4 py-2 transition-colors rounded-sm ${isActive("/") ? "text-primary font-semibold" : "text-white/80 hover:text-white"}`}
            >
              Home
            </Link>

            {/* Shop dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setIsShopOpen(true)}
              onMouseLeave={() => setIsShopOpen(false)}
            >
              <Link
                href="/menu"
                className={`flex items-center gap-1 px-4 py-2 transition-colors rounded-sm ${isActive("/menu") ? "text-primary font-semibold" : "text-white/80 hover:text-white"}`}
              >
                Shop <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isShopOpen ? "rotate-180" : ""}`} />
              </Link>

              {isShopOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
                  <div className="bg-white border border-border shadow-xl rounded-sm min-w-[220px] py-2">
                    <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-b border-border mb-1">
                      Categories
                    </div>
                    {SHOP_CATEGORIES.map((cat) => (
                      <Link
                        key={cat.href}
                        href={cat.href}
                        onClick={closeMenu}
                        className="block px-4 py-2.5 text-sm text-foreground hover:bg-accent hover:text-primary transition-colors"
                      >
                        {cat.label}
                      </Link>
                    ))}
                    <div className="border-t border-border mt-1 pt-1">
                      <Link
                        href="/menu"
                        onClick={closeMenu}
                        className="block px-4 py-2.5 text-sm font-semibold text-primary hover:bg-accent transition-colors"
                      >
                        View All Products →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link
              href="/menu?deals=true"
              className="px-4 py-2 transition-colors rounded-sm text-white/80 hover:text-white"
            >
              Deals
            </Link>
            <Link
              href="/blog"
              className={`px-4 py-2 transition-colors rounded-sm ${isActive("/blog") ? "text-primary font-semibold" : "text-white/80 hover:text-white"}`}
            >
              Blog
            </Link>
          </nav>

          {/* Actions */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              aria-label="Search"
              className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <Link href="/cart" className="relative group w-9 h-9 flex items-center justify-center text-white/70 hover:text-white transition-colors">
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile actions */}
          <div className="lg:hidden flex items-center gap-3">
            <Link href="/cart" className="relative group" onClick={closeMenu}>
              <ShoppingBag className="w-6 h-6 text-white/80" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            <button
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              className="w-9 h-9 flex items-center justify-center text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-secondary pt-[108px] overflow-y-auto">
          <nav className="flex flex-col px-6 py-4 text-base font-medium">
            <Link href="/" onClick={closeMenu} className="py-4 border-b border-white/10 text-white/80 hover:text-white transition-colors">Home</Link>

            <div className="border-b border-white/10">
              <button
                className="w-full flex items-center justify-between py-4 text-white/80"
                onClick={() => setIsShopOpen(!isShopOpen)}
              >
                <span>Shop</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isShopOpen ? "rotate-180" : ""}`} />
              </button>
              {isShopOpen && (
                <div className="pb-3 pl-4 space-y-1">
                  {SHOP_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.href}
                      href={cat.href}
                      onClick={closeMenu}
                      className="block py-2.5 text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/menu?deals=true" onClick={closeMenu} className="py-4 border-b border-white/10 text-white/80 hover:text-white transition-colors">Deals</Link>
            <Link href="/blog" onClick={closeMenu} className="py-4 border-b border-white/10 text-white/80 hover:text-white transition-colors">Blog</Link>
            <Link href="/cart" onClick={closeMenu} className="py-4 text-white/80 hover:text-white transition-colors">Cart</Link>
          </nav>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      {/* ── FOOTER ─── */}
      <footer className="bg-secondary text-white">
        {/* Top info bar */}
        <div className="border-b border-white/10 py-4">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-primary" />
              <span>Mombasa, Kenya — Mon–Sat 8am–7pm · Sun 10am–5pm</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 shrink-0 text-primary" />
              <a href="tel:+254700000000" className="hover:text-white transition-colors">+254 700 000 000</a>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pt-14 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="h-16 w-28 mb-5">
                <RevealImage
                  src={DEFAULT_LOGO_IMAGE_URL}
                  alt="HAPPYFINE_KE"
                  className="object-contain"
                  eager
                  placeholderClassName="bg-transparent"
                  timeoutMs={2000}
                />
              </div>
              <p className="text-white/55 text-sm leading-7 max-w-xs mb-6">
                Your soft life ambassador. Premium home appliances, kitchen essentials, and lifestyle products — wholesale prices in Mombasa.
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary mb-3">Follow us</p>
              <div className="flex items-center gap-2.5">
                {SOCIALS.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-sm flex items-center justify-center bg-white/10 hover:bg-primary transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Shop */}
            <div>
              <h4 className="font-bold mb-5 uppercase tracking-[0.2em] text-[11px] text-primary">Shop</h4>
              <ul className="space-y-3 text-sm text-white/55">
                {SHOP_CATEGORIES.slice(0, 5).map((cat) => (
                  <li key={cat.href}>
                    <Link href={cat.href} className="hover:text-white transition-colors">{cat.label}</Link>
                  </li>
                ))}
                <li>
                  <Link href="/menu" className="hover:text-white transition-colors">All Products</Link>
                </li>
              </ul>
            </div>

            {/* Quick links */}
            <div>
              <h4 className="font-bold mb-5 uppercase tracking-[0.2em] text-[11px] text-primary">Information</h4>
              <ul className="space-y-3 text-sm text-white/55">
                <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link href="/menu?deals=true" className="hover:text-white transition-colors">Deals &amp; Offers</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/cart" className="hover:text-white transition-colors">Cart</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-bold mb-5 uppercase tracking-[0.2em] text-[11px] text-primary">Contact Us</h4>
              <ul className="space-y-3 text-sm text-white/55">
                <li>
                  <a href="mailto:info@happyfineke.co.ke" className="hover:text-white transition-colors">
                    info@happyfineke.co.ke
                  </a>
                </li>
                <li>
                  <a href="tel:+254700000000" className="hover:text-white transition-colors">
                    +254 700 000 000
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/254700000000?text=Hi!%20I%27m%20interested%20in%20your%20products." target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    WhatsApp us
                  </a>
                </li>
                <li className="text-white/40 text-xs leading-relaxed pt-1">
                  Mombasa, Kenya<br />Mon–Sat: 8am – 7pm
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/35">
            <span>&copy; {new Date().getFullYear()} HAPPYFINE_KE Wholesalers. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <span className="italic text-white/30">Soft life ambassador</span>
              <Link href="/login" className="hover:text-white/60 transition-colors">Staff login</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* WhatsApp sticky CTA */}
      <a
        href="https://wa.me/254700000000?text=Hi!%20I%27m%20interested%20in%20your%20products%20at%20HAPPYFINE_KE."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-6 left-4 z-50 flex items-center gap-2 bg-[#25D366] text-white p-3.5 sm:pl-3.5 sm:pr-5 sm:py-3 rounded-full shadow-lg shadow-green-500/25 hover:bg-green-500 active:scale-95 transition-all"
      >
        <SiWhatsapp className="w-5 h-5 shrink-0" />
        <span className="hidden sm:inline text-sm font-semibold">Chat with us</span>
      </a>

      {/* Floating cart pill — mobile only */}
      {itemCount > 0 && location !== "/cart" && !location.startsWith("/checkout") && !location.startsWith("/order") && (
        <Link
          href="/cart"
          aria-label={`View cart — ${itemCount} ${itemCount === 1 ? "item" : "items"}`}
          className="lg:hidden fixed bottom-6 right-4 z-50 flex items-center gap-2 bg-primary text-primary-foreground pl-4 pr-5 py-3.5 rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
        >
          <ShoppingBag className="w-5 h-5 shrink-0" />
          <span className="font-semibold text-sm">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          <span className="text-sm text-primary-foreground/75">· KES {total.toLocaleString()}</span>
        </Link>
      )}
    </div>
  );
}
