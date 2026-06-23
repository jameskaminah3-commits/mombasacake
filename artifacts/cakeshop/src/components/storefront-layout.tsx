import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import {
  ShoppingBag, Menu, X, Search, ChevronDown, ChevronRight,
  MapPin, Phone, Truck,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { SiFacebook, SiInstagram, SiTiktok, SiWhatsapp } from "react-icons/si";
import { DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";
import { RevealImage } from "@/components/reveal-image";

const CATEGORY_NAV_GROUPS = [
  {
    label: "Kitchen & Lifestyle",
    href: "/menu?category=kitchen",
    items: [
      { label: "Kitchen Appliances",      href: "/menu?category=kitchen" },
      { label: "Personal Care",           href: "/menu?category=personal-care" },
      { label: "Bedroom",                 href: "/menu?category=bedroom" },
      { label: "Living Room",             href: "/menu?category=living-room" },
      { label: "Small Appliances",        href: "/menu?category=small-appliances" },
    ],
  },
  {
    label: "Appliances",
    href: "/menu?category=appliances",
    items: [
      { label: "Refrigerators",           href: "/menu?category=refrigerators" },
      { label: "Washing Machines",        href: "/menu?category=washing-machines" },
      { label: "Air Conditioners & Fans", href: "/menu?category=ac-fans" },
      { label: "Cookers & Ovens",         href: "/menu?category=cookers" },
      { label: "Microwaves",              href: "/menu?category=microwaves" },
    ],
  },
  {
    label: "Fitness",
    href: "/menu?category=fitness",
    items: [
      { label: "Treadmills",              href: "/menu?category=treadmills" },
      { label: "Exercise Bikes",          href: "/menu?category=exercise-bikes" },
      { label: "Weights & Barbells",      href: "/menu?category=weights" },
      { label: "Gym Benches",             href: "/menu?category=benches" },
      { label: "Cardio Equipment",        href: "/menu?category=cardio" },
    ],
  },
  {
    label: "Electronics",
    href: "/menu?category=electronics",
    items: [
      { label: "TVs & Entertainment",     href: "/menu?category=tvs" },
      { label: "Sound Systems",           href: "/menu?category=sound" },
      { label: "Smart Home",              href: "/menu?category=smart-home" },
      { label: "Home Office",             href: "/menu?category=home-office" },
      { label: "Accessories",             href: "/menu?category=accessories" },
    ],
  },
];

const FOOTER_SHOP_LINKS = [
  { label: "Kitchen & Utensils",   href: "/menu?category=kitchen" },
  { label: "Home Appliances",      href: "/menu?category=appliances" },
  { label: "Gym & Fitness",        href: "/menu?category=gym" },
  { label: "Personal Care",        href: "/menu?category=personal-care" },
  { label: "Bedroom",              href: "/menu?category=bedroom" },
];

const SOCIALS = [
  { icon: SiFacebook,  href: "https://www.facebook.com/happyfineke", label: "Facebook" },
  { icon: SiInstagram, href: "https://instagram.com/happyfineke",    label: "Instagram" },
  { icon: SiTiktok,    href: "https://tiktok.com/@happyfineke",      label: "TikTok" },
  { icon: SiWhatsapp,  href: "https://wa.me/254700000000",           label: "WhatsApp" },
];

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { itemCount, total } = useCart();
  const [location, setLocation] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openNavItem,      setOpenNavItem]      = useState<string | null>(null);
  const [mobileOpenGroup,  setMobileOpenGroup]  = useState<string | null>(null);

  const closeMenu = () => { setIsMobileMenuOpen(false); setMobileOpenGroup(null); };

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = ((new FormData(e.currentTarget).get("q") as string) ?? "").trim();
    if (q) { setLocation(`/menu?search=${encodeURIComponent(q)}`); closeMenu(); }
  };

  const isActive = (href: string) =>
    location === href || location.startsWith(href.split("?")[0] + "?") || location === href.split("?")[0];

  const activeDropdownGroup = CATEGORY_NAV_GROUPS.find((g) => g.label === openNavItem) ?? null;

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans bg-background">

      {/* ── STICKY HEADER ───────────────────────────────────── */}
      <div className="sticky top-0 z-50">

        {/* Top info bar — desktop only */}
        <div className="hidden lg:block bg-secondary">
          <div className="container mx-auto px-4 h-9 flex items-center justify-between text-[11px] text-white/60">
            <div className="flex items-center gap-6">
              <a href="tel:+254700000000" className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Phone className="w-3 h-3 shrink-0" />
                +254 700 000 000
              </a>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 shrink-0" />
                Mombasa, Kenya — Mon–Sat 8am–7pm
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Truck className="w-3 h-3 text-primary shrink-0" />
              Free delivery on orders over{" "}
              <span className="text-white font-semibold ml-1">KES 5,000</span>
            </div>
          </div>
        </div>

        {/* Main header — white */}
        <header className="bg-white border-b border-gray-100 shadow-sm">
          <div className="container mx-auto px-4 h-[68px] flex items-center gap-4">

            {/* Logo */}
            <Link href="/" onClick={closeMenu} aria-label="HAPPYFINE_KE home" className="shrink-0">
              <div className="h-12 w-24">
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

            {/* Search bar — center, desktop */}
            <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-2xl mx-auto relative">
              <input
                name="q"
                type="search"
                placeholder="Search appliances, fitness equipment, electronics..."
                className="w-full h-11 pl-4 pr-14 border-2 border-secondary/30 focus:border-secondary rounded-none text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none transition-colors"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 h-11 w-12 flex items-center justify-center bg-secondary text-white hover:bg-secondary/90 transition-colors"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>

            {/* Right actions */}
            <div className="ml-auto lg:ml-0 flex items-center gap-1">
              <button
                aria-label="Search"
                className="lg:hidden w-10 h-10 flex items-center justify-center text-secondary hover:text-foreground transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>

              <Link
                href="/cart"
                onClick={closeMenu}
                className="relative flex items-center gap-2 px-3 h-10 text-secondary hover:text-foreground transition-colors group"
              >
                <div className="relative">
                  <ShoppingBag className="w-5 h-5" />
                  {itemCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {itemCount}
                    </span>
                  )}
                </div>
                {itemCount > 0 && (
                  <span className="hidden sm:inline text-sm font-medium text-foreground">
                    KES {total.toLocaleString()}
                  </span>
                )}
                <span className="sr-only">Cart</span>
              </Link>

              <button
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                className="lg:hidden w-10 h-10 flex items-center justify-center text-secondary"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </header>

        {/* Nav bar — desktop */}
        <div
          className="hidden lg:block relative bg-secondary"
          onMouseLeave={() => setOpenNavItem(null)}
        >
          <nav className="container mx-auto px-4 h-11 flex items-center gap-0 text-sm font-medium">
            {CATEGORY_NAV_GROUPS.map((group) => {
              const isGroupActive = group.items.some((i) => isActive(i.href)) || isActive(group.href);
              return (
                <div key={group.label} onMouseEnter={() => setOpenNavItem(group.label)}>
                  <Link
                    href={group.href}
                    onClick={() => setOpenNavItem(null)}
                    className={`flex items-center gap-1 px-4 h-11 transition-colors border-b-2 ${
                      isGroupActive || openNavItem === group.label
                        ? "text-primary border-primary"
                        : "text-white/80 hover:text-white border-transparent"
                    }`}
                  >
                    {group.label}
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        openNavItem === group.label ? "rotate-180" : ""
                      }`}
                    />
                  </Link>
                </div>
              );
            })}

            <Link
              href="/menu?deals=true"
              className="px-4 h-11 flex items-center text-white/80 hover:text-white transition-colors border-b-2 border-transparent"
            >
              Deals
            </Link>
            <Link
              href="/blog"
              className={`px-4 h-11 flex items-center transition-colors border-b-2 ${
                isActive("/blog") ? "text-primary border-primary" : "text-white/80 hover:text-white border-transparent"
              }`}
            >
              Blog
            </Link>
          </nav>

          {/* Category dropdown panel */}
          {activeDropdownGroup && (
            <div className="absolute top-full left-0 right-0 bg-white border-b border-border shadow-2xl z-50">
              <div className="container mx-auto px-4 py-7">
                <div className="flex gap-12">
                  <div className="shrink-0 min-w-[200px]">
                    <h3 className="font-bold text-[10px] uppercase tracking-[0.22em] text-primary mb-5">
                      {activeDropdownGroup.label}
                    </h3>
                    <ul className="space-y-2.5">
                      {activeDropdownGroup.items.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpenNavItem(null)}
                            className="flex items-center gap-1.5 text-sm text-foreground/65 hover:text-primary transition-colors group/link"
                          >
                            <ChevronRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0" />
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={activeDropdownGroup.href}
                      onClick={() => setOpenNavItem(null)}
                      className="mt-6 inline-flex items-center text-[11px] font-bold text-primary hover:underline uppercase tracking-wide"
                    >
                      View all {activeDropdownGroup.label} <ChevronRight className="w-3 h-3 ml-0.5" />
                    </Link>
                  </div>

                  <div className="flex-1 border-l border-border pl-12 flex items-center">
                    <div className="rounded-xl p-6 w-full max-w-xs" style={{ backgroundColor: "#e8ede8" }}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "rgba(1,50,32,0.5)" }}>
                        Shop Now
                      </p>
                      <h4 className="font-serif text-lg font-bold text-foreground mb-1 leading-snug">
                        {activeDropdownGroup.label}
                      </h4>
                      <p className="text-xs text-foreground/55 mb-4">Wholesale prices in Mombasa</p>
                      <Link
                        href={activeDropdownGroup.href}
                        onClick={() => setOpenNavItem(null)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:text-primary transition-colors uppercase tracking-wide"
                      >
                        Browse all <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE MENU ─────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-secondary overflow-y-auto pt-[68px]">
          <div className="px-4 py-4 border-b border-white/10">
            <form onSubmit={handleSearch} className="relative">
              <input
                name="q"
                type="search"
                placeholder="Search products..."
                className="w-full h-11 pl-4 pr-12 bg-white/10 border border-white/20 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-primary rounded-none"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 h-11 w-12 flex items-center justify-center text-white/60 hover:text-primary"
                aria-label="Search"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>
          </div>

          <nav className="flex flex-col px-4 py-2 text-sm font-medium">
            <Link href="/" onClick={closeMenu} className="py-4 border-b border-white/10 text-white/80 hover:text-white">
              Home
            </Link>

            {CATEGORY_NAV_GROUPS.map((group) => (
              <div key={group.label} className="border-b border-white/10">
                <button
                  className="w-full flex items-center justify-between py-4 text-white/80"
                  onClick={() => setMobileOpenGroup(mobileOpenGroup === group.label ? null : group.label)}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${mobileOpenGroup === group.label ? "rotate-180" : ""}`}
                  />
                </button>
                {mobileOpenGroup === group.label && (
                  <div className="pb-3">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMenu}
                        className="flex items-center gap-2 px-2 py-2 text-white/60 hover:text-white transition-colors"
                      >
                        <ChevronRight className="w-3 h-3 shrink-0" />
                        {item.label}
                      </Link>
                    ))}
                    <Link
                      href={group.href}
                      onClick={closeMenu}
                      className="flex items-center gap-2 px-2 py-2.5 mt-1 text-primary font-semibold text-xs uppercase tracking-wide"
                    >
                      View all {group.label} <ChevronRight className="w-3 h-3 shrink-0" />
                    </Link>
                  </div>
                )}
              </div>
            ))}

            <Link href="/menu?deals=true" onClick={closeMenu} className="py-4 border-b border-white/10 text-white/80 hover:text-white">
              Deals
            </Link>
            <Link href="/blog" onClick={closeMenu} className="py-4 border-b border-white/10 text-white/80 hover:text-white">
              Blog
            </Link>
            <Link href="/cart" onClick={closeMenu} className="py-4 flex items-center justify-between text-white/80 hover:text-white">
              <span>Cart</span>
              {itemCount > 0 && (
                <span className="bg-primary text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="bg-[#F2F2F2] text-foreground">
        <div className="border-b border-border py-4">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 shrink-0 text-secondary" />
              Mombasa, Kenya — Mon–Sat 8am–7pm · Sun 10am–5pm
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 shrink-0 text-secondary" />
              <a href="tel:+254700000000" className="hover:text-foreground transition-colors">+254 700 000 000</a>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 pt-14 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

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
              <p className="text-muted-foreground text-sm leading-7 max-w-xs mb-6">
                Your soft life ambassador. Premium home appliances, kitchen essentials, and lifestyle products — wholesale prices in Mombasa.
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-secondary mb-3">Follow us</p>
              <div className="flex items-center gap-2.5">
                {SOCIALS.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 flex items-center justify-center bg-foreground/8 hover:bg-secondary hover:text-white transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-5 uppercase tracking-[0.2em] text-[11px] text-secondary">Shop</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {FOOTER_SHOP_LINKS.map((cat) => (
                  <li key={cat.href}>
                    <Link href={cat.href} className="hover:text-foreground transition-colors">{cat.label}</Link>
                  </li>
                ))}
                <li><Link href="/menu" className="hover:text-foreground transition-colors">All Products</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-5 uppercase tracking-[0.2em] text-[11px] text-secondary">Information</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="/" className="hover:text-foreground transition-colors">Home</Link></li>
                <li><Link href="/menu?deals=true" className="hover:text-foreground transition-colors">Deals &amp; Offers</Link></li>
                <li><Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link></li>
                <li><Link href="/cart" className="hover:text-foreground transition-colors">Cart</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-5 uppercase tracking-[0.2em] text-[11px] text-secondary">Contact Us</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a href="mailto:info@happyfineke.co.ke" className="hover:text-foreground transition-colors">
                    info@happyfineke.co.ke
                  </a>
                </li>
                <li>
                  <a href="tel:+254700000000" className="hover:text-foreground transition-colors">+254 700 000 000</a>
                </li>
                <li>
                  <a
                    href="https://wa.me/254700000000?text=Hi!%20I%27m%20interested%20in%20your%20products."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors"
                  >
                    WhatsApp us
                  </a>
                </li>
                <li className="text-muted-foreground/60 text-xs leading-relaxed pt-1">
                  Mombasa, Kenya<br />Mon–Sat: 8am – 7pm
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/60">
            <span>&copy; {new Date().getFullYear()} HAPPYFINE_KE Wholesalers. All rights reserved.</span>
            <div className="flex items-center gap-6">
              <span className="italic text-muted-foreground/40">Soft life ambassador</span>
              <Link href="/login" className="hover:text-foreground transition-colors">Staff login</Link>
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
      {itemCount > 0 &&
        location !== "/cart" &&
        !location.startsWith("/checkout") &&
        !location.startsWith("/order") && (
          <Link
            href="/cart"
            aria-label={`View cart — ${itemCount} items`}
            className="lg:hidden fixed bottom-6 right-4 z-50 flex items-center gap-2 bg-primary text-primary-foreground pl-4 pr-5 py-3.5 rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
          >
            <ShoppingBag className="w-5 h-5 shrink-0" />
            <span className="font-semibold text-sm">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="text-sm text-primary-foreground/75">· KES {total.toLocaleString()}</span>
          </Link>
        )}
    </div>
  );
}
