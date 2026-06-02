import { useState } from "react";
import { 
  useListPromotions, 
  useCreatePromotion, 
  useUpdatePromotion, 
  useDeletePromotion,
  getListPromotionsQueryKey,
  Promotion
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Trash2, Edit, Plus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

const promoSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  discountPct: z.coerce.number().min(0).max(100).optional().nullable(),
  active: z.boolean().default(true),
});

type PromoFormValues = z.infer<typeof promoSchema>;

export default function AdminMarketing() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  const { data: promotions, isLoading } = useListPromotions();
  
  const createPromo = useCreatePromotion();
  const updatePromo = useUpdatePromotion();
  const deletePromo = useDeletePromotion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<PromoFormValues>({
    resolver: zodResolver(promoSchema),
    defaultValues: {
      title: "",
      description: "",
      discountPct: null,
      active: true,
    },
  });

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListPromotionsQueryKey() });
  };

  const onSubmit = async (values: PromoFormValues) => {
    try {
      if (editingPromo) {
        await updatePromo.mutateAsync({
          id: editingPromo.id,
          data: {
            ...values,
            discountPct: values.discountPct || undefined,
          }
        });
        toast({ title: "Promotion updated successfully" });
      } else {
        await createPromo.mutateAsync({
          data: {
            ...values,
            discountPct: values.discountPct || undefined,
          }
        });
        toast({ title: "Promotion created successfully" });
      }
      setIsDialogOpen(false);
      invalidateQueries();
    } catch (error) {
      toast({ title: "An error occurred", variant: "destructive" });
    }
  };

  const handleEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    form.reset({
      title: promo.title,
      description: promo.description || "",
      discountPct: promo.discountPct || null,
      active: promo.active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePromo.mutateAsync({ id });
      toast({ title: "Promotion deleted successfully" });
      invalidateQueries();
    } catch (error) {
      toast({ title: "Failed to delete promotion", variant: "destructive" });
    }
  };

  const toggleActive = async (promo: Promotion) => {
    try {
      await updatePromo.mutateAsync({
        id: promo.id,
        data: { active: !promo.active }
      });
      invalidateQueries();
    } catch (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Marketing & Promotions</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingPromo(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> New Promotion
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPromo ? "Edit Promotion" : "Create New Promotion"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Valentine's Day Special" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Details about the promotion..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="discountPct"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Discount % (Optional)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="15" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="active"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createPromo.isPending || updatePromo.isPending}>
                    {editingPromo ? "Save Changes" : "Create Promotion"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[250px]" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[60px] rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-[60px] rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[80px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : promotions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No promotions found.
                </TableCell>
              </TableRow>
            ) : (
              promotions?.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-medium">
                    {promo.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[300px] truncate">
                    {promo.description || "—"}
                  </TableCell>
                  <TableCell>
                    {promo.discountPct ? (
                      <span className="bg-primary/10 text-primary font-bold px-2 py-1 rounded text-xs uppercase tracking-wider">
                        {promo.discountPct}% OFF
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={promo.active} 
                        onCheckedChange={() => toggleActive(promo)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {promo.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Promotion</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the promotion <strong>{promo.title}</strong>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(promo.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
