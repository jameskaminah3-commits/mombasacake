import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SiFacebook, SiInstagram, SiTiktok, SiYoutube, SiWhatsapp } from "react-icons/si";
import { DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";

const SOCIALS = [
  { icon: SiFacebook, href: "https://www.facebook.com/Channah-cakes-1412705188869989/", label: "Facebook" },
  { icon: SiInstagram, href: "https://instagram.com/channahcakes001?igshid=1783kk7yjr97i", label: "Instagram" },
  { icon: SiTiktok, href: "https://tiktok.com/@channahcakes", label: "TikTok" },
  { icon: SiYoutube, href: "https://www.youtube.com/channel/UCDW0CaXYw7CuE-8Y13PIcOQ", label: "YouTube" },
  { icon: SiWhatsapp, href: "https://wa.me/254721868212", label: "WhatsApp" },
];

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { itemCount } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const closeMenu = () => setIsMobileMenuOpen(false);

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      onClick={closeMenu}
      className={`transition-colors hover:text-primary ${location === href ? "text-primary font-semibold" : "text-foreground/80"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center" onClick={closeMenu} aria-label="Channah Cakes home">
            <img src={DEFAULT_LOGO_IMAGE_URL} alt="Channah Cakes" className="h-14 w-auto object-contain sm:h-16" />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {navLink("/", "Home")}
            {navLink("/menu", "Menu")}
            {navLink("/blog", "Blog")}
            <Link href="/cart" className="relative group">
              <ShoppingBag className="w-5 h-5 text-foreground/80 group-hover:text-primary transition-colors" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>

          <div className="md:hidden flex items-center gap-4">
            <Link href="/cart" className="relative group" onClick={closeMenu}>
              <ShoppingBag className="w-6 h-6 text-foreground/80" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-20">
          <nav className="flex flex-col items-center gap-6 p-8 text-base font-medium text-center">
            <Link href="/" onClick={closeMenu} className={`${location === "/" ? "text-primary font-bold" : "text-foreground/80"}`}>Home</Link>
            <Link href="/menu" onClick={closeMenu} className={`${location === "/menu" ? "text-primary font-bold" : "text-foreground/80"}`}>Menu</Link>
            <Link href="/blog" onClick={closeMenu} className={`${location === "/blog" ? "text-primary font-bold" : "text-foreground/80"}`}>Blog</Link>
            <Link href="/cart" onClick={closeMenu} className={`${location === "/cart" ? "text-primary font-bold" : "text-foreground/80"}`}>Cart</Link>
          </nav>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="bg-[#1a0d12] text-white">
        <div className="container mx-auto px-4 pt-16 pb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center mb-4">
                <img src={DEFAULT_LOGO_IMAGE_URL} alt="Channah Cakes" className="h-[4.5rem] w-auto object-contain" />
              </div>
              <p className="text-white/60 text-sm leading-7 max-w-xs">
                Premium artisan celebration cakes, custom creations, and everyday indulgences — handcrafted in Mombasa, Kenya.
              </p>
              {/* Socials */}
              <div className="mt-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/40">Follow us</p>
                <div className="flex items-center gap-3">
                  {SOCIALS.map(({ icon: Icon, href, label }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-[#E0187A] transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Explore */}
            <div>
              <h4 className="font-semibold mb-5 uppercase tracking-widest text-[11px] text-[#E0187A]">Explore</h4>
              <ul className="space-y-3 text-sm leading-7 text-white/60">
                <li><Link href="/" className="hover:text-white transition-colors">Home</Link></li>
                <li><Link href="/menu" className="hover:text-white transition-colors">Our Menu</Link></li>
                <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/cart" className="hover:text-white transition-colors">Cart</Link></li>
              </ul>
            </div>

            {/* Visit */}
            <div>
              <h4 className="font-semibold mb-5 uppercase tracking-widest text-[11px] text-[#E0187A]">Visit Us</h4>
              <ul className="space-y-3 text-sm leading-7 text-white/60">
                <li>Mombasa, Kenya</li>
                <li>Mon – Sat: 8am – 7pm</li>
                <li>Sun: 9am – 5pm</li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-5 uppercase tracking-widest text-[11px] text-[#E0187A]">Contact</h4>
              <ul className="space-y-3 text-sm leading-7 text-white/60">
                <li>
                  <a href="mailto:channahcakes@gmail.com" className="hover:text-white transition-colors">
                    channahcakes@gmail.com
                  </a>
                </li>
                <li>
                  <a href="tel:+254721868212" className="hover:text-white transition-colors">
                    +254 721 868 212
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/254721868212" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                    WhatsApp us
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <span>&copy; {new Date().getFullYear()} Channah Cakes. All rights reserved.</span>
            <Link href="/login" className="hover:text-white/60 transition-colors">Staff login</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
