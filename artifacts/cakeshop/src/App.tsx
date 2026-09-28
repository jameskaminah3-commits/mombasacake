import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/lib/cart-context";
import { AuthProvider } from "@/lib/auth-context";
import { AdminGuard } from "@/components/admin-guard";

// Layouts
import { StorefrontLayout } from "@/components/storefront-layout";

// The shop page ships with the app; every other page is downloaded when first needed,
// so shoppers on mobile data never download the admin panel.
import Home from "@/pages/home";
import Menu from "@/pages/menu";
import NotFound from "@/pages/not-found";

const loadCakeDetail = () => import("@/pages/cake");
const loadCart = () => import("@/pages/cart");
const loadCheckout = () => import("@/pages/checkout");

// Storefront Pages
const CakeDetail = lazy(loadCakeDetail);
const Cart = lazy(loadCart);
const Checkout = lazy(loadCheckout);
const OrderSuccess = lazy(() => import("@/pages/order"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogPost = lazy(() => import("@/pages/blog-post"));
const Login = lazy(() => import("@/pages/login"));

// Admin
const AdminLayout = lazy(() => import("@/components/admin-layout").then((module) => ({ default: module.AdminLayout })));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminCakes = lazy(() => import("@/pages/admin/cakes"));
const AdminCategories = lazy(() => import("@/pages/admin/categories"));
const AdminOrders = lazy(() => import("@/pages/admin/orders"));
const AdminCustomers = lazy(() => import("@/pages/admin/customers"));
const AdminPayments = lazy(() => import("@/pages/admin/payments"));
const AdminHomepage = lazy(() => import("@/pages/admin/homepage"));
const AdminMediaLibrary = lazy(() => import("@/pages/admin/media-library"));
const AdminMarketing = lazy(() => import("@/pages/admin/marketing"));

function PageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status" aria-label="Loading">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary/20 border-t-primary" />
    </div>
  );
}

// Once the shop has loaded, fetch the pages a shopper is likely to open next in the background,
// so tapping a cake or the cart doesn't wait on the network.
function PrefetchShopPages() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCakeDetail();
      void loadCart();
      void loadCheckout();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

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
    <Suspense fallback={<PageLoading />}>
      <Switch>
        {/* Login — standalone, no layout */}
        <Route path="/login" component={Login} />

        {/* Admin Routes — protected */}
        <Route path="/admin" nest>
          <AdminGuard>
            <AdminLayout>
              <Suspense fallback={<PageLoading />}>
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
              </Suspense>
            </AdminLayout>
          </AdminGuard>
        </Route>

        {/* Storefront Routes */}
        <Route>
          <StorefrontLayout>
            <PrefetchShopPages />
            <Suspense fallback={<PageLoading />}>
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
            </Suspense>
          </StorefrontLayout>
        </Route>
      </Switch>
    </Suspense>
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
