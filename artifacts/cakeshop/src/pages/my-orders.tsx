import { Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import { getOrder, type Order } from "@workspace/api-client-react";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadSavedOrders, orderPath, useAccountOverview, useCustomerSession, useEmailLoginAvailable } from "@/lib/customer";
import { cn } from "@/lib/utils";

type OrderRow = {
  id: number;
  accessToken: string | null;
  createdAt: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentCheck?: { state: string } | null;
  summary: string;
};

export function orderStatusLabel(order: { status: string; paymentStatus: string; paymentCheck?: { state: string } | null }) {
  if (order.status === "cancelled") return "Cancelled";
  if (order.status === "delivered") return "Delivered";
  if (order.status === "ready") return "Ready";
  if (order.status === "preparing") return "Being made";
  if (order.paymentStatus === "paid") return "Paid";
  // The M-Pesa code the customer sent: being checked, or not found in the shop's M-Pesa.
  if (order.paymentCheck?.state === "checking") return "Checking payment";
  if (order.paymentCheck?.state === "not-found") return "Payment not found";
  if (order.paymentStatus === "failed") return "Payment failed";
  return "Waiting for payment";
}

const summarize = (items: { cakeName: string; quantity: number }[]) =>
  items.map((item) => `${item.quantity > 1 ? `${item.quantity} × ` : ""}${item.cakeName}`).join(", ");

// Orders placed on this phone (remembered with their private links), plus a signed-in customer's orders from anywhere.
export default function MyOrders() {
  const session = useCustomerSession();
  const loginAvailable = useEmailLoginAvailable();
  const { data: account, isLoading: accountLoading } = useAccountOverview();
  const saved = loadSavedOrders();
  const savedQueries = useQueries({
    queries: saved.map((entry) => ({
      queryKey: ["order", entry.id, entry.token, null, null],
      queryFn: () => getOrder(entry.id, { headers: entry.token ? { "X-Order-Token": entry.token } : {} }),
      retry: false,
    })),
  });

  const rows = new Map<number, OrderRow>();
  for (const order of account?.orders ?? []) {
    rows.set(order.id, { ...order, summary: summarize(order.items) });
  }
  savedQueries.forEach((query) => {
    const order = query.data as Order | undefined;
    if (!order) return;
    const known = rows.get(order.id);
    if (known) {
      known.paymentCheck = order.paymentCheck ?? null;
    } else {
      rows.set(order.id, {
        id: order.id,
        accessToken: order.accessToken ?? null,
        createdAt: order.createdAt,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentCheck: order.paymentCheck ?? null,
        summary: summarize(order.items),
      });
    }
  });
  const list = [...rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const loading = savedQueries.some((query) => query.isLoading) || (!!session && accountLoading);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6">
      <h1 className="text-2xl font-extrabold tracking-tight">My orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {session ? `Signed in as ${session.email}.` : "Orders placed on this phone."}
        {!session && loginAvailable && (
          <>
            {" "}
            <Link href="/account" className="font-semibold text-primary underline-offset-2 hover:underline">
              Sign in
            </Link>{" "}
            to see orders from your other devices.
          </>
        )}
      </p>

      <div className="mt-5 space-y-3">
        {loading && list.length === 0 ? (
          [1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
            <ShoppingBag className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-semibold">No orders yet</p>
            <p className="mt-1 text-sm text-muted-foreground">When you order, it shows up here so you can follow it and order again.</p>
            <Button asChild className="mt-5 rounded-full">
              <Link href="/">Browse cakes</Link>
            </Button>
          </div>
        ) : (
          list.map((order) => (
            <Link
              key={order.id}
              href={orderPath(order)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-bold">
                  Order #{order.id}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      order.status === "cancelled"
                        ? "bg-muted text-muted-foreground"
                        : order.paymentStatus === "paid"
                          ? "bg-primary/10 text-primary"
                          : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {orderStatusLabel(order)}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{order.summary}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(order.createdAt), "d MMM yyyy")} · KES {Math.round(order.total).toLocaleString()}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
