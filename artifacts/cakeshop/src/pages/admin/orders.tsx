import { useState } from "react";
import {
  useListOrders,
  useUpdateOrderStatus,
  getListOrdersQueryKey,
  customFetch,
  type Order,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Link } from "wouter";
import { Link2, Pencil, Plus, Search } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { AdminOrderForm, ORDER_STATUSES as STATUSES } from "@/components/admin-order-form";
import { customerOrderLink, orderPath } from "@/lib/customer";
import { orderItemChoices } from "@/lib/order-items";
import { normalizeKenyanPhone } from "@/lib/phone";
import { normalizeSupabaseMediaUrl } from "@/lib/supabase-media";

// A ready-to-send WhatsApp update for the customer, matching where their order is, with their private order link.
function customerUpdateMessage(order: Order) {
  const name = order.customerName.trim().split(/\s+/)[0] || order.customerName;
  const update =
    order.status === "cancelled"
      ? `your order #${order.id} has been cancelled.`
      : order.status === "delivered"
        ? `your order #${order.id} has been delivered. Enjoy! We'd love a quick review on your order page.`
        : order.status === "ready"
          ? `your order #${order.id} is ready!`
          : order.status === "preparing"
            ? `your cake for order #${order.id} is being made.`
            : order.paymentStatus === "paid"
              ? `we've received your payment for order #${order.id}. Thank you!`
              : `thank you for your order #${order.id} (KES ${Math.round(order.total).toLocaleString()}). You can pay with M-Pesa on your order page.`;
  return `Hi ${name}, ${update}\n\nFollow your order here: ${customerOrderLink(order)}\n\nChannah Cake House`;
}

const customerWhatsAppUrl = (order: Order) =>
  `https://wa.me/${normalizeKenyanPhone(order.customerPhone)}?text=${encodeURIComponent(customerUpdateMessage(order))}`;

export default function AdminOrders() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  
  const listParams = { status: filterStatus !== "all" ? filterStatus : undefined };
  // Refreshed every 30 seconds, so new orders and customers' M-Pesa codes show up without reloading.
  const { data: orders, isLoading } = useListOrders(listParams, {
    query: { queryKey: getListOrdersQueryKey(listParams), refetchInterval: 30_000 },
  });
  
  const updateStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filteredOrders = orders?.filter((order) => {
    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "to-check" ? order.paymentStatus !== "paid" && !!order.reportedPayment : order.paymentStatus === paymentFilter);
    const haystack = [
      String(order.id),
      order.customerName,
      order.customerPhone,
      order.customerEmail || "",
      order.items.map((item) => item.cakeName).join(" "),
    ].join(" ").toLowerCase();
    return matchesPayment && haystack.includes(search.trim().toLowerCase());
  });
  const summaryOrders = filteredOrders ?? [];
  const summary = {
    orders: summaryOrders.length,
    paid: summaryOrders.filter((order) => order.paymentStatus === "paid").length,
    pending: summaryOrders.filter((order) => order.status === "pending").length,
    cakes: summaryOrders.reduce(
      (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    ),
  };

  const handleStatusChange = async (orderId: number, status: string) => {
    try {
      await updateStatus.mutateAsync({
        id: orderId,
        data: { status }
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Order status updated" });
    } catch (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const handleMarkPaid = async (order: Order) => {
    const receipt = window.prompt(
      "Enter the M-Pesa receipt code from the payment SMS (optional):",
      order.reportedPayment?.receipt ?? "",
    );
    if (receipt === null) return; // cancelled
    const orderId = order.id;
    try {
      await customFetch(`${getApiBaseUrl()}/api/orders/${orderId}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpesaReceiptNo: receipt.trim() || undefined }),
      });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Payment marked as paid" });
    } catch (error) {
      toast({ title: "Failed to mark as paid", variant: "destructive" });
    }
  };

  // The customer's code isn't in the shop's M-Pesa: they're asked (by email, and on their order page) to check it.
  const handleCodeNotFound = async (order: Order) => {
    if (!window.confirm(`Tell ${order.customerName} that code ${order.reportedPayment?.receipt ?? ""} wasn't found in your M-Pesa?`)) return;
    try {
      await customFetch(`${getApiBaseUrl()}/api/orders/${order.id}/payment-code/not-found`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Customer asked to check their code" });
    } catch {
      toast({ title: "Couldn't update the order", variant: "destructive" });
    }
  };

  const openOrderForm = (order: Order | null) => {
    setEditingOrder(order);
    setFormOpen(true);
  };

  const copyCustomerLink = async (order: Order) => {
    try {
      await navigator.clipboard.writeText(customerOrderLink(order));
      toast({ title: "Customer link copied", description: `Send it to ${order.customerName} to follow and pay for order #${order.id}.` });
    } catch {
      window.prompt("Copy the customer's order link:", customerOrderLink(order));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500';
      case 'preparing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-500';
      case 'ready': return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-500';
      case 'delivered': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <AdminOrderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        order={editingOrder}
        onSaved={() => queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() })}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <Button type="button" onClick={() => openOrderForm(null)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" /> New order
          </Button>
        </div>
        
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search orders or cakes..."
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="sm:w-[180px]" aria-label="Filter by order status">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              {STATUSES.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="sm:w-[170px]" aria-label="Filter by payment">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="to-check">Codes to check</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Orders shown</p>
            <p className="mt-2 text-2xl font-bold">{summary.orders}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid orders</p>
            <p className="mt-2 text-2xl font-bold text-[#52B44B]">{summary.paid}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending orders</p>
            <p className="mt-2 text-2xl font-bold text-primary">{summary.pending}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Cakes booked</p>
            <p className="mt-2 text-2xl font-bold">{summary.cakes}</p>
          </div>
        </div>
      )}

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Cakes</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-[220px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-[140px]" /></TableCell>
                </TableRow>
              ))
            ) : filteredOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col items-start gap-1.5">
                      <Link href={`~${orderPath(order)}`} className="hover:underline text-primary">
                        #{order.id}
                      </Link>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => openOrderForm(order)}
                        aria-label={`Edit order #${order.id}`}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-7 px-2 text-xs">
                        <a
                          href={customerWhatsAppUrl(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp ${order.customerName} about order #${order.id}`}
                          title="Opens WhatsApp with an update and their order link, ready to send"
                        >
                          <SiWhatsapp className="mr-1 h-3 w-3 text-[#25D366]" /> Update
                        </a>
                      </Button>
                      <button
                        type="button"
                        onClick={() => copyCustomerLink(order)}
                        className="inline-flex items-center text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        aria-label={`Copy the customer's link for order #${order.id}`}
                      >
                        <Link2 className="mr-1 h-3 w-3" /> Copy link
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(order.createdAt), 'MMM d, h:mm a')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{order.customerName}</span>
                      <span className="text-xs text-muted-foreground">{order.customerPhone}</span>
                      {order.customerEmail && (
                        <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                      )}
                      {order.deliveryAddress && (
                        <span className="mt-1 max-w-[220px] truncate text-xs text-muted-foreground">
                          {order.deliveryAddress}
                        </span>
                      )}
                      {order.deliveryDate && (
                        <span className="mt-1 text-xs font-semibold text-foreground">
                          Deliver {format(new Date(`${order.deliveryDate}T00:00:00`), "EEE d MMM")}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[300px] space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2 text-sm">
                          {item.cakeImage && (
                            <img
                              src={normalizeSupabaseMediaUrl(item.cakeImage) || item.cakeImage}
                              alt=""
                              className="h-8 w-8 shrink-0 rounded-md object-cover"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium leading-5">
                              {item.quantity}x {item.cakeName}
                              {item.variantLabel ? ` (${item.variantLabel})` : ""}
                            </p>
                            {orderItemChoices(item).map((choice) => (
                              <p key={choice} className="text-xs leading-5 text-muted-foreground">{choice}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Customer notes; orders placed before per-cake choices were saved also list flavours here. */}
                      {order.notes && (
                        <p className="mt-2 whitespace-pre-line rounded-md bg-muted/60 p-2 text-xs leading-5 text-foreground">
                          {order.notes}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                        order.paymentStatus === 'paid' ? 'bg-[#52B44B]/10 text-[#52B44B]' :
                        order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.paymentStatus}
                      </span>
                      {order.paymentStatus !== 'paid' && order.reportedPayment && (
                        <p className="max-w-[170px] rounded-md bg-amber-50 p-1.5 text-xs leading-5 text-amber-900">
                          {order.reportedPayment.source === "customer" ? (
                            <>
                              Customer sent M-Pesa code <strong className="font-mono">{order.reportedPayment.receipt}</strong> for KES{" "}
                              {order.reportedPayment.amount.toLocaleString()}. Check your M-Pesa, then mark paid.
                            </>
                          ) : (
                            <>
                              M-Pesa reported KES {order.reportedPayment.amount.toLocaleString()}
                              {order.reportedPayment.receipt ? ` (${order.reportedPayment.receipt})` : ""}. Check your M-Pesa, then mark paid.
                            </>
                          )}
                        </p>
                      )}
                      {order.paymentStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(order)}
                          className="text-xs font-medium text-[#52B44B] underline underline-offset-2 hover:text-[#52B44B]/80"
                        >
                          Mark paid
                        </button>
                      )}
                      {order.paymentStatus !== 'paid' && order.reportedPayment?.source === "customer" && (
                        <button
                          type="button"
                          onClick={() => handleCodeNotFound(order)}
                          className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
                        >
                          Code not found
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-bold">KES {order.total.toLocaleString()}</p>
                    {order.discountAmount > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {order.promoCode ? `${order.promoCode}: ` : "Discount: "}−KES {order.discountAmount.toLocaleString()}
                      </p>
                    )}
                    {(order.creditUsed ?? 0) > 0 && (
                      <p className="text-xs text-muted-foreground">Referral credit: −KES {(order.creditUsed ?? 0).toLocaleString()}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select 
                      value={order.status} 
                      onValueChange={(val) => handleStatusChange(order.id, val)}
                    >
                      <SelectTrigger className={`w-[140px] h-8 text-xs font-bold uppercase tracking-wider ${getStatusColor(order.status)} border-0 ring-0 focus:ring-0`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
