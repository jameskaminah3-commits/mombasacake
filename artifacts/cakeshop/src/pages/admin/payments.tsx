import { 
  useListPayments 
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Link } from "wouter";

export default function AdminPayments() {
  const { data: payments, isLoading } = useListPayments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground mt-1">Transaction history and MPesa records.</p>
      </div>

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
            ) : payments?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              payments?.map((payment) => (
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
                      payment.status === 'paid' ? 'bg-[#52B44B]/10 text-[#52B44B]' : 
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
