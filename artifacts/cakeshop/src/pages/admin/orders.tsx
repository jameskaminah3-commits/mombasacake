import { useState } from "react";
import { 
  useListOrders, 
  useUpdateOrderStatus,
  getListOrdersQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
import { format } from "date-fns";
import { Link } from "wouter";

const STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  const { data: orders, isLoading } = useListOrders({
    status: filterStatus !== "all" ? filterStatus : undefined
  });
  
  const updateStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            {STATUSES.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
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
                  <TableCell><Skeleton className="h-6 w-[80px] rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-10 w-[140px]" /></TableCell>
                </TableRow>
              ))
            ) : orders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    <Link href={`/order/${order.id}`} className="hover:underline text-primary">
                      #{order.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(order.createdAt), 'MMM d, h:mm a')}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{order.customerName}</span>
                      <span className="text-xs text-muted-foreground">{order.customerPhone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                      order.paymentStatus === 'paid' ? 'bg-[#52B44B]/10 text-[#52B44B]' : 
                      order.paymentStatus === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.paymentStatus}
                    </span>
                  </TableCell>
                  <TableCell className="font-bold">
                    KES {order.total.toLocaleString()}
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
