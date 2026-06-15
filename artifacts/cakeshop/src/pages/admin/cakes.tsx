import { useState } from "react";
import {
  useListCakes,
  useCreateCake,
  useUpdateCake,
  useDeleteCake,
  useListCategories,
  getListCakesQueryKey,
  getListCategoriesQueryKey,
  getGetFeaturedCakesQueryKey,
  getGetPopularCakesQueryKey,
  Cake
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { AdminImageUpload } from "@/components/admin-image-upload";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, Plus, Search, Star, StarOff, X } from "lucide-react";
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
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { normalizeSupabaseMediaUrl } from "@/lib/supabase-media";

const variantSchema = z.object({
  label: z.string().min(1, "Label required"),
  price: z.coerce.number().min(0, "Price required"),
});

const cakeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  slug: z.string().min(2, "Slug is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  imageUrl: z.string().optional(),
  categoryId: z.coerce.number().optional().nullable(),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  variants: z.array(variantSchema).optional(),
});

type CakeFormValues = z.infer<typeof cakeSchema>;

const defaultCakeFormValues: CakeFormValues = {
  name: "",
  slug: "",
  description: "",
  price: 0,
  imageUrl: "",
  categoryId: null,
  available: true,
  featured: false,
  variants: [],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminCakes() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCake, setEditingCake] = useState<Cake | null>(null);

  const { data: cakes, isLoading } = useListCakes({ search: search || undefined });
  const { data: categories } = useListCategories();
  
  const createCake = useCreateCake();
  const updateCake = useUpdateCake();
  const deleteCake = useDeleteCake();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<CakeFormValues>({
    resolver: zodResolver(cakeSchema),
    defaultValues: defaultCakeFormValues,
  });

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const selectedImage = form.watch("imageUrl");

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListCakesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetFeaturedCakesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPopularCakesQueryKey() });
  };

  const onSubmit = async (values: CakeFormValues) => {
    try {
      const variants = values.variants && values.variants.length > 0 ? values.variants : undefined;
      if (editingCake) {
        await updateCake.mutateAsync({
          id: editingCake.id,
          data: {
            ...values,
            categoryId: values.categoryId ?? undefined,
            imageUrl: values.imageUrl?.trim() || undefined,
            variants: variants ?? null,
          }
        });
        toast({ title: "Cake updated successfully" });
      } else {
        await createCake.mutateAsync({
          data: {
            ...values,
            categoryId: values.categoryId ?? undefined,
            imageUrl: values.imageUrl?.trim() || undefined,
            variants,
          }
        });
        toast({ title: "Cake created successfully" });
      }
      setIsDialogOpen(false);
      invalidateQueries();
    } catch (error) {
      toast({ title: "An error occurred", variant: "destructive" });
    }
  };

  const handleEdit = (cake: Cake) => {
    setEditingCake(cake);
    form.reset({
      name: cake.name,
      slug: cake.slug,
      description: cake.description || "",
      price: cake.price,
      imageUrl: cake.imageUrl || "",
      categoryId: cake.categoryId || null,
      available: cake.available,
      featured: cake.featured,
      variants: cake.variants ?? [],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCake.mutateAsync({ id });
      toast({ title: "Cake deleted successfully" });
      invalidateQueries();
    } catch (error) {
      toast({ title: "Failed to delete cake", variant: "destructive" });
    }
  };

  const toggleAvailability = async (cake: Cake) => {
    try {
      await updateCake.mutateAsync({
        id: cake.id,
        data: { available: !cake.available }
      });
      invalidateQueries();
    } catch (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const toggleFeatured = async (cake: Cake) => {
    try {
      await updateCake.mutateAsync({
        id: cake.id,
        data: { featured: !cake.featured }
      });
      invalidateQueries();
    } catch (error) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Cakes Management</h1>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCake(null);
            form.reset(defaultCakeFormValues);
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Add New Cake
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCake ? "Edit Cake" : "Add New Cake"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Chocolate Truffle..."
                            {...field}
                            onBlur={(event) => {
                              field.onBlur();
                              if (!form.getValues("slug")) {
                                form.setValue("slug", slugify(event.target.value), { shouldValidate: true });
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="chocolate-truffle" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe the cake..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (KES)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))}
                          value={field.value ? field.value.toString() : "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {categories?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id.toString()}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image</FormLabel>
                      <AdminImageUpload
                        label="Cake image"
                        folder="cakes"
                        value={selectedImage || ""}
                        onChange={(url) => form.setValue("imageUrl", url, { shouldValidate: true, shouldDirty: true })}
                        onClear={() => form.setValue("imageUrl", "", { shouldValidate: true, shouldDirty: true })}
                        helperText="Upload a single image for the cake listing and detail page."
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Variants / size options */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-base">Size Variants <span className="text-muted-foreground font-normal text-xs">(optional)</span></FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => appendVariant({ label: "", price: 0 })}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Size
                    </Button>
                  </div>
                  {variantFields.length === 0 && (
                    <p className="text-xs text-muted-foreground">No size variants. The base price above applies. Add variants if this cake comes in multiple sizes with different prices.</p>
                  )}
                  {variantFields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <Input
                        placeholder="e.g. 1 kg"
                        className="flex-1"
                        {...form.register(`variants.${index}.label`)}
                      />
                      <Input
                        type="number"
                        placeholder="Price (KES)"
                        className="w-32"
                        {...form.register(`variants.${index}.price`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => removeVariant(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-8">
                  <FormField
                    control={form.control}
                    name="available"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 w-full">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Available</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="featured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 w-full">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Featured</FormLabel>
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
                  <Button type="submit" disabled={createCake.isPending || updateCake.isPending}>
                    {editingCake ? "Save Changes" : "Create Cake"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 max-w-sm mb-4">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input 
          placeholder="Search cakes..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-md bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="w-12 h-12 rounded-md" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[200px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-[100px] ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : cakes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No cakes found.
                </TableCell>
              </TableRow>
            ) : (
              cakes?.map((cake) => (
                <TableRow key={cake.id}>
                  <TableCell>
                    <img
                      src={normalizeSupabaseMediaUrl(cake.imageUrl || DEFAULT_CAKE_IMAGE_URL) || DEFAULT_CAKE_IMAGE_URL}
                      alt={cake.name}
                      className="w-12 h-12 rounded-md object-cover bg-muted"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {cake.name}
                  </TableCell>
                  <TableCell>
                    {cake.categoryName ? (
                      <Badge variant="outline">{cake.categoryName}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">Uncategorized</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {cake.variants && cake.variants.length > 0 ? (
                      <div className="space-y-0.5">
                        <span className="text-xs text-muted-foreground">From KES {Math.min(...cake.variants.map((v) => v.price)).toLocaleString()}</span>
                        <div>
                          <Badge variant="outline" className="text-xs">{cake.variants.length} size{cake.variants.length !== 1 ? "s" : ""}</Badge>
                        </div>
                      </div>
                    ) : (
                      `KES ${cake.price.toLocaleString()}`
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={cake.available} 
                        onCheckedChange={() => toggleAvailability(cake)}
                      />
                      <span className="text-sm text-muted-foreground">
                        {cake.available ? "Available" : "Sold out"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleFeatured(cake)}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                        cake.featured ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                      title={cake.featured ? "Remove from featured" : "Add to featured"}
                    >
                      {cake.featured ? <Star className="w-3.5 h-3.5 fill-current" /> : <StarOff className="w-3.5 h-3.5" />}
                      {cake.featured ? "Featured" : "Not featured"}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(cake)}>
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
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the cake <strong>{cake.name}</strong>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(cake.id)}
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
