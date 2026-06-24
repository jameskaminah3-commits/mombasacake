import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { AdminGuard } from "@/components/admin-guard";

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
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import Login from "@/pages/login";

// Admin Pages
import AdminDashboard from "@/pages/admin/dashboard";
import AdminCakes from "@/pages/admin/cakes";
import AdminCategories from "@/pages/admin/categories";
import AdminOrders from "@/pages/admin/orders";
import AdminCustomers from "@/pages/admin/customers";
import AdminPayments from "@/pages/admin/payments";
import AdminHomepage from "@/pages/admin/homepage";
import AdminMediaLibrary from "@/pages/admin/media-library";
import AdminMarketing from "@/pages/admin/marketing";

import NotFound from "@/pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function Router() {
  return (
    <Switch>
      {/* Login — standalone, no layout */}
      <Route path="/login" component={Login} />

      {/* Admin Routes — protected */}
      <Route path="/admin" nest>
        <AdminGuard>
          <AdminLayout>
            <Switch>
              <Route path="/" component={AdminDashboard} />
              <Route path="/cakes" component={AdminCakes} />
              <Route path="/categories" component={AdminCategories} />
              <Route path="/orders" component={AdminOrders} />
              <Route path="/customers" component={AdminCustomers} />
              <Route path="/payments" component={AdminPayments} />
              <Route path="/homepage" component={AdminHomepage} />
              <Route path="/media-library" component={AdminMediaLibrary} />
              <Route path="/marketing" component={AdminMarketing} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        </AdminGuard>
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
            <Route path="/blog" component={Blog} />
            <Route path="/blog/:slug" component={BlogPost} />
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
        <AuthProvider>
          <CartProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
               <ScrollToTop />
              <Router />
            </WouterRouter>
          </CartProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
