import { Link, useLocation } from "wouter";
import { useCart } from "@/lib/cart-context";
import { ShoppingBag, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const { itemCount } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2" onClick={closeMenu}>
            <span className="font-serif text-2xl font-bold text-primary tracking-tight">Crème & Co.</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link
              href="/"
              className={`transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-foreground/80"}`}
            >
              Home
            </Link>
            <Link
              href="/menu"
              className={`transition-colors hover:text-primary ${location === "/menu" ? "text-primary" : "text-foreground/80"}`}
            >
              Menu
            </Link>
            <Link href="/cart" className="relative group">
              <ShoppingBag className="w-5 h-5 text-foreground/80 group-hover:text-primary transition-colors" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>

          {/* Mobile Menu Toggle */}
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

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background pt-20">
          <nav className="flex flex-col items-center gap-8 p-8 text-lg font-serif">
            <Link
              href="/"
              onClick={closeMenu}
              className={`${location === "/" ? "text-primary font-bold" : "text-foreground/80"}`}
            >
              Home
            </Link>
            <Link
              href="/menu"
              onClick={closeMenu}
              className={`${location === "/menu" ? "text-primary font-bold" : "text-foreground/80"}`}
            >
              Menu
            </Link>
          </nav>
        </div>
      )}

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="bg-foreground text-background py-12">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h3 className="font-serif text-2xl font-bold mb-4 text-secondary">Crème & Co.</h3>
            <p className="text-muted/80 text-sm max-w-xs mx-auto md:mx-0">
              Premium artisan celebration cakes, custom creations, and everyday indulgences based in Nairobi, Kenya.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-sm text-secondary">Explore</h4>
            <ul className="space-y-2 text-sm text-muted/80">
              <li><Link href="/" className="hover:text-primary-foreground transition-colors">Home</Link></li>
              <li><Link href="/menu" className="hover:text-primary-foreground transition-colors">Menu</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4 uppercase tracking-wider text-sm text-secondary">Connect</h4>
            <p className="text-muted/80 text-sm mb-2">Nairobi, Kenya</p>
            <p className="text-muted/80 text-sm">hello@cremeandco.ke</p>
            <p className="text-muted/80 text-sm">+254 700 000 000</p>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-muted/20 text-center text-sm text-muted/50">
          &copy; {new Date().getFullYear()} Crème & Co. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
