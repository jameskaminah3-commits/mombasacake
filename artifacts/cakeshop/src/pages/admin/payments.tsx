import { useEffect, useState } from "react";
import { useListPayments } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { Loader2, Search } from "lucide-react";
import {
  DEFAULT_PAYMENT_SETTINGS,
  fetchPaymentSettings,
  savePaymentSettings,
  type PaymentSettings,
} from "@/lib/payment-settings";

export default function AdminPayments() {
  const { data: payments, isLoading } = useListPayments();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: paymentSettings, isLoading: settingsLoading, isPlaceholderData } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: fetchPaymentSettings,
    placeholderData: DEFAULT_PAYMENT_SETTINGS,
  });
  const [draftSettings, setDraftSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);

  useEffect(() => {
    if (paymentSettings && !isPlaceholderData) {
      setDraftSettings(paymentSettings);
    }
  }, [paymentSettings, isPlaceholderData]);

  const saveSettingsMutation = useMutation({
    mutationFn: savePaymentSettings,
    onSuccess: (saved) => {
      setDraftSettings(saved);
      queryClient.setQueryData(["payment-settings"], saved);
    },
  });

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

  const updateSetting = (key: keyof PaymentSettings, value: string) => {
    setDraftSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = () => {
    saveSettingsMutation.mutate(draftSettings);
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

      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight">MPesa payment settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown to customers at checkout. Changes take effect immediately.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Payment display name</label>
            <Input
              value={draftSettings.displayName}
              onChange={(event) => updateSetting("displayName", event.target.value)}
              placeholder="MPesa"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Business shortcode (Paybill / Till)</label>
            <Input
              value={draftSettings.businessShortCode}
              onChange={(event) => updateSetting("businessShortCode", event.target.value)}
              placeholder="174379"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Order reference prefix</label>
            <Input
              value={draftSettings.accountReferencePrefix}
              onChange={(event) => updateSetting("accountReferencePrefix", event.target.value)}
              placeholder="Order"
            />
            <p className="text-xs text-muted-foreground">Customers will see this as the account reference on the MPesa prompt, e.g. "Order #42".</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Checkout instructions</label>
          <Textarea
            value={draftSettings.instructions}
            onChange={(event) => updateSetting("instructions", event.target.value)}
            rows={4}
            placeholder="Explain the payment steps customers should follow."
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            className="h-11 rounded-full bg-[#52B44B] px-6 text-white hover:bg-[#52B44B]/90"
            onClick={handleSave}
            disabled={settingsLoading || isPlaceholderData || saveSettingsMutation.isPending}
          >
            {saveSettingsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save settings"
            )}
          </Button>
        </div>

        {saveSettingsMutation.isSuccess && (
          <p className="text-sm font-medium text-[#52B44B]">Payment details updated successfully.</p>
        )}

        {saveSettingsMutation.isError && (
          <p className="text-sm font-medium text-red-600">Unable to save the payment settings. Please try again.</p>
        )}
      </div>

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
                    <Link href={`/order/${payment.orderId}`} className="text-primary hover:underline">
                      #{payment.orderId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-bold">KES {payment.amount.toLocaleString()}</TableCell>
                  <TableCell>{payment.method}</TableCell>
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
                      {payment.status}
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
