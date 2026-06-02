import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart-context";

// Layouts
import { StorefrontLayout } from "@/components/storefront-layout";
import { AdminLayout } from "@/components/admin-layout";

// Storefront Pages
import Home from "@/pages/home";
import Menu from "@/pages/menu";
import CakeDetail from "@/pages/cake";
import Cart from "@/pages/cart";
import Checkout from "@/pages/checkout";
import OrderSuccess from "@/pages/order";

// Admin Pages
import AdminDashboard from "@/pages/admin/dashboard";
import AdminCakes from "@/pages/admin/cakes";
import AdminCategories from "@/pages/admin/categories";
import AdminOrders from "@/pages/admin/orders";
import AdminCustomers from "@/pages/admin/customers";
import AdminPayments from "@/pages/admin/payments";
import AdminMarketing from "@/pages/admin/marketing";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Admin Routes */}
      <Route path="/admin" nest>
        <AdminLayout>
          <Switch>
            <Route path="/" component={AdminDashboard} />
            <Route path="/cakes" component={AdminCakes} />
            <Route path="/categories" component={AdminCategories} />
            <Route path="/orders" component={AdminOrders} />
            <Route path="/customers" component={AdminCustomers} />
            <Route path="/payments" component={AdminPayments} />
            <Route path="/marketing" component={AdminMarketing} />
            <Route component={NotFound} />
          </Switch>
        </AdminLayout>
      </Route>

      {/* Storefront Routes */}
      <Route>
        <StorefrontLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/menu" component={Menu} />
            <Route path="/cake/:id" component={CakeDetail} />
            <Route path="/cart" component={Cart} />
            <Route path="/checkout" component={Checkout} />
            <Route path="/order/:id" component={OrderSuccess} />
            <Route component={NotFound} />
          </Switch>
        </StorefrontLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </CartProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
