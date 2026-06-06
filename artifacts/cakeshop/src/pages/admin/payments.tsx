import { 
  useListPayments 
} from "@workspace/api-client-react";
import { useState } from "react";
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
import { format } from "date-fns";
import { Link } from "wouter";
import { Search } from "lucide-react";

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
          <p className="text-muted-foreground mt-1">Transaction history and MPesa records.</p>
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
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayments?.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(payment.createdAt), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/order/${payment.orderId}`} className="text-primary hover:underline">
                      #{payment.orderId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-bold">
                    KES {payment.amount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {payment.method}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {payment.mpesaReceiptNo || "—"}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      payment.status === 'paid' || payment.status === 'completed' ? 'bg-[#52B44B]/10 text-[#52B44B]' : 
                      payment.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
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
