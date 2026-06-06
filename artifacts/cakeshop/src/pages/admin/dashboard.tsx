import { useGetDashboardStats, useGetDashboardRecentOrders, useGetDashboardRevenueChart } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Clock, Images, PackageCheck, ShoppingBag, Star, TrendingUp, Users } from "lucide-react";

const emptyStats = {
  totalRevenue: 0,
  todayRevenue: 0,
  todayOrders: 0,
  pendingOrders: 0,
  totalOrders: 0,
  totalCustomers: 0,
  paidOrders: 0,
  bookedCakes: 0,
  paidCakes: 0,
  activeListings: 0,
  featuredListings: 0,
};

export default function Dashboard() {
  const { data: stats, isLoading: loadingStats } = useGetDashboardStats();
  const { data: recentOrders, isLoading: loadingOrders } = useGetDashboardRecentOrders();
  const { data: revenueData, isLoading: loadingRevenue } = useGetDashboardRevenueChart();
  const dashboardStats = { ...emptyStats, ...(stats ?? {}) };
  const orders = recentOrders ?? [];
  const revenuePoints = revenueData ?? [];
  const statCards = [
    {
      label: "Today's Revenue",
      value: `KES ${dashboardStats.todayRevenue.toLocaleString()}`,
      icon: TrendingUp,
      href: "/payments",
    },
    {
      label: "Pending Orders",
      value: dashboardStats.pendingOrders.toLocaleString(),
      icon: Clock,
      href: "/orders",
      accent: "text-primary",
    },
    {
      label: "Paid Orders",
      value: dashboardStats.paidOrders.toLocaleString(),
      icon: CheckCircle2,
      href: "/orders",
    },
    {
      label: "Booked Cakes",
      value: dashboardStats.bookedCakes.toLocaleString(),
      icon: ShoppingBag,
      href: "/orders",
    },
    {
      label: "Paid Cakes",
      value: dashboardStats.paidCakes.toLocaleString(),
      icon: PackageCheck,
      href: "/payments",
    },
    {
      label: "Active Listings",
      value: dashboardStats.activeListings.toLocaleString(),
      icon: Images,
      href: "/cakes",
    },
    {
      label: "Featured",
      value: dashboardStats.featuredListings.toLocaleString(),
      icon: Star,
      href: "/cakes",
      accent: "text-primary",
    },
    {
      label: "Customers",
      value: dashboardStats.totalCustomers.toLocaleString(),
      icon: Users,
      href: "/customers",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight md:text-3xl">Channah Admin</h1>
        <p className="text-muted-foreground mt-1">Overview of your shop's performance.</p>
      </div>

      {/* Stats Row */}
      {loadingStats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 md:p-6"><Skeleton className="h-14 w-full md:h-16" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, href, accent }) => (
            <Link key={label} href={href}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start justify-between gap-2 pb-2">
                    <p className="text-xs font-medium leading-snug text-muted-foreground md:text-sm">{label}</p>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className={`break-words text-xl font-bold md:text-2xl ${accent || ""}`}>{value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Chart */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="px-4 md:px-6">
            <CardTitle>Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            {loadingRevenue ? (
              <Skeleton className="h-[240px] w-full md:h-[300px]" />
            ) : revenuePoints.length > 0 ? (
              <div className="h-[240px] w-full md:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenuePoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(new Date(val), 'MMM d')}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      width={38}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `K ${val/1000}k`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                      formatter={(val: number) => [`KES ${val.toLocaleString()}`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="grid h-[300px] place-items-center rounded-lg border border-dashed border-border text-center">
                <div>
                  <p className="text-sm font-medium text-foreground">No revenue yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Paid orders will appear here.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 md:px-6">
            <CardTitle>Recent Orders</CardTitle>
            <Link href="/orders" className="flex shrink-0 items-center text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            {loadingOrders ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map(order => (
                  <div key={order.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">#{order.id} - {order.customerName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), 'MMM d, h:mm a')}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">KES {order.total.toLocaleString()}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500' :
                        order.status === 'delivered' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-border text-center">
                <div>
                  <p className="text-sm font-medium text-foreground">No recent orders</p>
                  <p className="mt-1 text-xs text-muted-foreground">New orders will show up here.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
