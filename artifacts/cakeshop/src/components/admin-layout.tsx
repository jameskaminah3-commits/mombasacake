import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CakeSlice, 
  Tags, 
  ShoppingBag, 
  Users, 
  CreditCard, 
  Megaphone,
  LogOut
} from "lucide-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
    { href: "/admin/cakes", label: "Cakes", icon: CakeSlice },
    { href: "/admin/categories", label: "Categories", icon: Tags },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/payments", label: "Payments", icon: CreditCard },
    { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
  ];

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Link href="/admin" className="font-serif text-xl font-bold text-sidebar-foreground">Crème Admin</Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <Link href="/" className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
            <LogOut className="w-5 h-5" />
            Storefront
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-background border-b border-border flex items-center px-8 md:hidden">
          <Link href="/admin" className="font-serif text-xl font-bold">Crème Admin</Link>
        </header>
        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
