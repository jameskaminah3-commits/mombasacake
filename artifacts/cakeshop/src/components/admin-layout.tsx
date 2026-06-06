import { Link, useLocation } from "wouter";
import {
  CakeSlice,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Image as ImageIcon,
  ShoppingBag,
  Tags,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/cakes", label: "Cakes", icon: CakeSlice },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/homepage", label: "Homepage", icon: ImageIcon },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { admin, logout } = useAuth();

  const renderNavLink = (item: (typeof navItems)[number], closeOnClick = false) => {
    const Icon = item.icon;
    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
    const link = (
      <Link
        href={item.href}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {item.label}
      </Link>
    );

    return closeOnClick ? (
      <SheetClose asChild key={item.href}>
        {link}
      </SheetClose>
    ) : (
      <div key={item.href}>{link}</div>
    );
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Link href="/" className="font-serif text-xl font-bold text-sidebar-foreground">
            Channah Admin
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-4 py-6">
          {navItems.map((item) => renderNavLink(item))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-4">
          {admin && (
            <div className="mb-2 px-3 py-2">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{admin.name}</p>
              <p className="truncate text-xs text-sidebar-foreground/50">{admin.email}</p>
            </div>
          )}
          <Link href="~/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
            <ExternalLink className="h-5 w-5" />
            Storefront
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-red-50 hover:text-red-600"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open admin navigation">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex h-[100dvh] w-[min(22rem,88vw)] flex-col bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
              >
                <SheetHeader className="border-b border-sidebar-border px-5 py-5 text-left">
                  <SheetTitle className="font-serif text-xl text-sidebar-foreground">Channah Admin</SheetTitle>
                </SheetHeader>
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 pb-24">
                  {navItems.map((item) => renderNavLink(item, true))}
                </nav>
                <div className="border-t border-sidebar-border p-3">
                  {admin && (
                    <div className="mb-2 rounded-md px-3 py-2">
                      <p className="truncate text-xs font-medium text-sidebar-foreground">{admin.name}</p>
                      <p className="truncate text-xs text-sidebar-foreground/50">{admin.email}</p>
                    </div>
                  )}
                  <SheetClose asChild>
                    <Link href="~/" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
                      <ExternalLink className="h-5 w-5" />
                      Storefront
                    </Link>
                  </SheetClose>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-red-50 hover:text-red-600"
                    data-testid="button-mobile-logout"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <Link href="/" className="truncate font-serif text-lg font-bold md:hidden">
              Channah Admin
            </Link>
          </div>
          {admin && (
            <p className="hidden text-sm text-muted-foreground md:block">
              Signed in as <span className="font-medium text-foreground">{admin.name}</span>
            </p>
          )}
          <button
            onClick={logout}
            className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-red-600 md:hidden"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </header>

        <div className="overflow-x-auto border-b border-border bg-background px-4 py-2 md:hidden">
          <nav className="flex min-w-max gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
