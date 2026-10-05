import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListPayments } from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { Loader2, Search } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";
import { AdminPaymentSettings } from "@/components/admin-payment-settings";
import { fetchPaymentSettings } from "@/lib/payment-settings";

export default function AdminPayments() {
  const { data: payments, isLoading } = useListPayments();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredPayments = payments?.filter((payment) => {
    const normalizedStatus = payment.status === "completed" ? "paid" : payment.status;
    const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter || payment.status === statusFilter;
    const haystack = [
      String(payment.id),
      String(payment.orderId),
      payment.method,
      payment.status,
      payment.mpesaReceiptNo || "",
      payment.checkoutRequestId || "",
    ].join(" ").toLowerCase();
    return matchesStatus && haystack.includes(search.trim().toLowerCase());
  });
  const summaryPayments = filteredPayments ?? [];
  const paidPayments = summaryPayments.filter((payment) => payment.status === "paid" || payment.status === "completed");
  const summary = {
    totalPaid: paidPayments.reduce((sum, payment) => sum + payment.amount, 0),
    paid: paidPayments.length,
    pending: summaryPayments.filter((payment) => payment.status === "pending").length,
    failed: summaryPayments.filter((payment) => payment.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-1">Transaction history, MPesa records, and checkout payment settings.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search receipt or order..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <AdminPaymentSettings />

      <PaybillNotifications />

      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid amount</p>
            <p className="mt-2 text-2xl font-bold">KES {summary.totalPaid.toLocaleString()}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paid records</p>
            <p className="mt-2 text-2xl font-bold text-[#52B44B]">{summary.paid}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</p>
            <p className="mt-2 text-2xl font-bold text-primary">{summary.pending}</p>
          </div>
          <div className="rounded-md border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Failed</p>
            <p className="mt-2 text-2xl font-bold text-red-600">{summary.failed}</p>
          </div>
        </div>
      )}

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Order ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Receipt No.</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[60px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                </TableRow>
              ))
            ) : filteredPayments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments?.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(payment.createdAt), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`~/order/${payment.orderId}`} className="text-primary hover:underline">
                      #{payment.orderId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-bold">KES {payment.amount.toLocaleString()}</TableCell>
                  <TableCell>{payment.method === "mpesa-code" ? "M-Pesa code from customer" : payment.method}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.mpesaReceiptNo || "—"}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wider ${
                        payment.status === "paid" || payment.status === "completed"
                          ? "bg-[#52B44B]/10 text-[#52B44B]"
                          : payment.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {payment.status === "reported"
                        ? "check M-Pesa"
                        : payment.status === "rejected"
                          ? "code not found"
                          : payment.status === "replaced"
                            ? "code corrected"
                            : payment.status}
                    </span>
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

// Asks Safaricom to tell the shop about payments customers make from the M-Pesa menu (Pay Bill or Buy Goods), so
// those orders are marked paid without checking codes. Needs the shop's M-Pesa (Daraja) keys on the server.
function PaybillNotifications() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const { data: settings } = useQuery({ queryKey: ["payment-settings"], queryFn: fetchPaymentSettings, staleTime: 0 });
  const ready = settings?.darajaKeys === true;

  const register = async () => {
    setState("sending");
    setMessage(null);
    try {
      await customFetch(`${getApiBaseUrl()}/api/payments/mpesa/c2b/register`, { method: "POST" });
      setState("done");
    } catch (error) {
      const data = (error as { data?: { error?: unknown } } | null)?.data;
      setState("error");
      setMessage(typeof data?.error === "string" ? data.error : "Registering with Safaricom failed. Please try again.");
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-3">
      <h2 className="text-xl font-bold tracking-tight">Automatic payment confirmation (optional)</h2>
      <p className="text-sm text-muted-foreground">
        Safaricom can tell the shop about payments to your till or paybill, so orders are marked paid without checking codes. Press this once
        (and again if the shop's address changes). Payments Safaricom reports that can't be matched to an order show on the order as
        &ldquo;M-Pesa reported&rdquo; for you to check and mark paid.
      </p>
      {settings && !ready && (
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Needs the M-Pesa (Daraja) keys on the server first.</strong> Until then, customers send you their
          M-Pesa codes and you mark orders paid.
        </p>
      )}
      <Button type="button" variant="outline" className="rounded-full" onClick={register} disabled={state === "sending" || !ready}>
        {state === "sending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Register with Safaricom
      </Button>
      {state === "done" && <p className="text-sm font-medium text-[#52B44B]">Registered. Payments made with Lipa na M-Pesa will now mark orders paid.</p>}
      {state === "error" && message && <p className="text-sm font-medium text-red-600">{message}</p>}
    </div>
  );
}
