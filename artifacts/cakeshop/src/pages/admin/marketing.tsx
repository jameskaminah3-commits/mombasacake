import { useState } from "react";
import {
  getListPromotionsQueryKey,
  Promotion,
  useCreatePromotion,
  useDeletePromotion,
  useListCakes,
  useListPromotions,
  useUpdatePromotion,
} from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { AdminImageUpload } from "@/components/admin-image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Edit, ExternalLink, Plus, Trash2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-base";

type BlogPost = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
};

const promoSchema = z.object({
  title: z.string().min(2, "Title is required"),
  code: z.string().optional(),
  description: z.string().optional(),
  bannerUrl: z.string().optional(),
  discountMode: z.enum(["percentage", "amount"]),
  discountValue: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number().positive("Discount must be greater than zero").nullable(),
  ),
  scope: z.enum(["all", "specific_cakes", "minimum_order"]),
  minimumOrderAmount: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number().positive("Minimum order amount must be greater than zero").nullable(),
  ),
  applicableCakeSlugs: z.array(z.string()).default([]),
  active: z.boolean().default(true),
  showInStrip: z.boolean().default(true),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
}).superRefine((values, ctx) => {
  if (values.discountValue == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount value is required",
      path: ["discountValue"],
    });
  }

  if (values.scope === "minimum_order" && values.minimumOrderAmount == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Minimum order amount is required",
      path: ["minimumOrderAmount"],
    });
  }

  if (values.scope === "specific_cakes" && values.applicableCakeSlugs.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose at least one cake",
      path: ["applicableCakeSlugs"],
    });
  }
});

const blogSchema = z.object({
  title: z.string().min(2, "Title is required"),
  slug: z.string().min(2, "Slug is required").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens"),
  excerpt: z.string().optional(),
  content: z.string().min(10, "Content is required"),
  coverImageUrl: z.string().optional(),
  published: z.boolean().default(false),
  publishedAt: z.string().optional(),
});

type PromoFormValues = z.infer<typeof promoSchema>;
type BlogFormValues = z.infer<typeof blogSchema>;

const defaultPromoFormValues: PromoFormValues = {
  title: "",
  code: "",
  description: "",
  bannerUrl: "",
  discountMode: "percentage",
  discountValue: null,
  scope: "all",
  minimumOrderAmount: null,
  applicableCakeSlugs: [],
  active: true,
  showInStrip: true,
  startsAt: "",
  endsAt: "",
};

const defaultBlogFormValues: BlogFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: "",
  published: false,
  publishedAt: "",
};

const blogQueryKey = ["admin-blog-posts"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatShortDate(value?: string | null) {
  if (!value) return "Open";
  return format(new Date(value), "MMM d");
}

function formatDateInput(value?: string | null) {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd");
}

async function apiRequest<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export default function AdminMarketing() {
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isBlogDialogOpen, setIsBlogDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: promotions, isLoading: isLoadingPromotions } = useListPromotions();
  const { data: cakes } = useListCakes();
  const createPromo = useCreatePromotion();
  const updatePromo = useUpdatePromotion();
  const deletePromo = useDeletePromotion();
  const { data: blogPosts, isLoading: isLoadingBlog } = useQuery({
    queryKey: blogQueryKey,
    queryFn: () => apiRequest<BlogPost[]>("/api/blog/all", token),
    enabled: Boolean(token),
  });

  const createBlogPost = useMutation({
    mutationFn: (values: BlogFormValues) =>
      apiRequest<BlogPost>("/api/blog", token, {
        method: "POST",
        body: JSON.stringify(cleanBlogPayload(values)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blogQueryKey }),
  });

  const updateBlogPost = useMutation({
    mutationFn: ({ id, values }: { id: number; values: BlogFormValues }) =>
      apiRequest<BlogPost>(`/api/blog/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(cleanBlogPayload(values)),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blogQueryKey }),
  });

  const deleteBlogPost = useMutation({
    mutationFn: (id: number) => apiRequest<void>(`/api/blog/${id}`, token, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: blogQueryKey }),
  });

  const promoForm = useForm<PromoFormValues>({
    resolver: zodResolver(promoSchema),
    defaultValues: defaultPromoFormValues,
  });
  const promoScope = useWatch({ control: promoForm.control, name: "scope" });
  const promoDiscountMode = useWatch({ control: promoForm.control, name: "discountMode" });

  const blogForm = useForm<BlogFormValues>({
    resolver: zodResolver(blogSchema),
    defaultValues: defaultBlogFormValues,
  });
  const cakeNameBySlug = new Map((cakes ?? []).map((cake) => [cake.slug, cake.name]));

  const invalidatePromotions = () => {
    queryClient.invalidateQueries({ queryKey: getListPromotionsQueryKey() });
  };

  const handlePromoSubmit = async (values: PromoFormValues) => {
    try {
      const payload = {
        title: values.title.trim(),
        code: values.code?.trim() || undefined,
        description: values.description?.trim() || undefined,
        bannerUrl: values.bannerUrl?.trim() || undefined,
        discountPct: values.discountMode === "percentage" ? values.discountValue ?? undefined : undefined,
        discountAmount: values.discountMode === "amount" ? values.discountValue ?? undefined : undefined,
        minimumOrderAmount: values.scope === "minimum_order" ? values.minimumOrderAmount ?? undefined : undefined,
        applicableCakeSlugs: values.scope === "specific_cakes" ? values.applicableCakeSlugs : undefined,
        showInStrip: values.showInStrip,
        active: values.active,
        startsAt: values.startsAt || undefined,
        endsAt: values.endsAt || undefined,
      };

      if (editingPromo) {
        await updatePromo.mutateAsync({ id: editingPromo.id, data: payload });
        toast({ title: "Promotion updated successfully" });
      } else {
        await createPromo.mutateAsync({ data: payload });
        toast({ title: "Promotion created successfully" });
      }
      setIsPromoDialogOpen(false);
      invalidatePromotions();
    } catch (error) {
      toast({
        title: "Failed to save promotion",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBlogSubmit = async (values: BlogFormValues) => {
    try {
      if (editingPost) {
        await updateBlogPost.mutateAsync({ id: editingPost.id, values });
        toast({ title: "Blog post updated successfully" });
      } else {
        await createBlogPost.mutateAsync(values);
        toast({ title: "Blog post created successfully" });
      }
      setIsBlogDialogOpen(false);
      resetBlogDialog();
    } catch {
      toast({ title: "Failed to save blog post", variant: "destructive" });
    }
  };

  const handleEditPromo = (promo: Promotion) => {
    setEditingPromo(promo);
    promoForm.reset({
      title: promo.title,
      code: promo.code || "",
      description: promo.description || "",
      bannerUrl: promo.bannerUrl || "",
      discountMode: promo.discountAmount != null ? "amount" : "percentage",
      discountValue: promo.discountAmount ?? promo.discountPct ?? null,
      scope: promo.applicableCakeSlugs?.length
        ? "specific_cakes"
        : promo.minimumOrderAmount != null
          ? "minimum_order"
          : "all",
      minimumOrderAmount: promo.minimumOrderAmount ?? null,
      applicableCakeSlugs: promo.applicableCakeSlugs ?? [],
      active: promo.active,
      showInStrip: promo.showInStrip,
      startsAt: formatDateInput(promo.startsAt),
      endsAt: formatDateInput(promo.endsAt),
    });
    setIsPromoDialogOpen(true);
  };

  const handleEditBlogPost = (post: BlogPost) => {
    setEditingPost(post);
    blogForm.reset({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || "",
      content: post.content,
      coverImageUrl: post.coverImageUrl || "",
      published: post.published,
      publishedAt: formatDateInput(post.publishedAt),
    });
    setIsBlogDialogOpen(true);
  };

  const handleDeletePromo = async (id: number) => {
    try {
      await deletePromo.mutateAsync({ id });
      toast({ title: "Promotion deleted successfully" });
      invalidatePromotions();
    } catch {
      toast({ title: "Failed to delete promotion", variant: "destructive" });
    }
  };

  const handleDeleteBlogPost = async (id: number) => {
    try {
      await deleteBlogPost.mutateAsync(id);
      toast({ title: "Blog post deleted successfully" });
    } catch {
      toast({ title: "Failed to delete blog post", variant: "destructive" });
    }
  };

  const togglePromoActive = async (promo: Promotion) => {
    try {
      await updatePromo.mutateAsync({ id: promo.id, data: { active: !promo.active } });
      invalidatePromotions();
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const toggleBlogPublished = async (post: BlogPost) => {
    try {
      await updateBlogPost.mutateAsync({
        id: post.id,
        values: {
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt || "",
          content: post.content,
          coverImageUrl: post.coverImageUrl || "",
          published: !post.published,
          publishedAt: !post.published ? formatDateInput(post.publishedAt || new Date().toISOString()) : formatDateInput(post.publishedAt),
        },
      });
    } catch {
      toast({ title: "Failed to update blog status", variant: "destructive" });
    }
  };

  const resetPromoDialog = () => {
    setEditingPromo(null);
    promoForm.reset(defaultPromoFormValues);
  };

  const resetBlogDialog = () => {
    setEditingPost(null);
    blogForm.reset(defaultBlogFormValues);
  };

  const publishedCount = blogPosts?.filter((post) => post.published).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage offers and blog stories from one place.</p>
        </div>
      </div>

      <Tabs defaultValue="promotions" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
        </TabsList>

        <TabsContent value="promotions" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Promotions</h2>
              <p className="text-sm text-muted-foreground">{promotions?.length ?? 0} campaigns configured</p>
            </div>

            <Dialog open={isPromoDialogOpen} onOpenChange={(open) => {
              setIsPromoDialogOpen(open);
              if (!open) resetPromoDialog();
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> New Promotion
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>{editingPromo ? "Edit Promotion" : "Create Promotion"}</DialogTitle>
                </DialogHeader>
                <Form {...promoForm}>
                  <form onSubmit={promoForm.handleSubmit(handlePromoSubmit)} className="space-y-4">
                    <FormField
                      control={promoForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl><Input placeholder="Valentine's Day Special" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={promoForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl><Textarea placeholder="Details about the promotion..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={promoForm.control}
                      name="bannerUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banner Image</FormLabel>
                          <AdminImageUpload
                            label="Banner image"
                            folder="promotions"
                            value={field.value || ""}
                            onChange={(url) => field.onChange(url)}
                            onClear={() => field.onChange("")}
                            helperText="Upload one image for the promotion banner."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={promoForm.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Checkout Code</FormLabel>
                          <FormControl><Input placeholder="WEEKEND15" {...field} /></FormControl>
                          <p className="text-xs text-muted-foreground">Leave blank for promos that should apply automatically without a code.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={promoForm.control}
                        name="discountMode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discount Type</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose a discount type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="percentage">Percentage off</SelectItem>
                                <SelectItem value="amount">Fixed amount off</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={promoForm.control}
                        name="discountValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{promoDiscountMode === "amount" ? "Discount Amount" : "Discount %"}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step={promoDiscountMode === "amount" ? "0.01" : "1"}
                                placeholder={promoDiscountMode === "amount" ? "1500" : "15"}
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={promoForm.control}
                      name="scope"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Applies To</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose where this offer applies" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="all">All cakes in cart</SelectItem>
                              <SelectItem value="specific_cakes">Specific cakes</SelectItem>
                              <SelectItem value="minimum_order">Cart total threshold</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">Choose whether the offer applies to everything, selected cakes, or a minimum order total.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {promoScope === "minimum_order" && (
                      <FormField
                        control={promoForm.control}
                        name="minimumOrderAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Minimum Cart Total</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" step="0.01" placeholder="3000" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {promoScope === "specific_cakes" && (
                      <FormField
                        control={promoForm.control}
                        name="applicableCakeSlugs"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Specific Cakes</FormLabel>
                            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border bg-background p-3">
                              {(cakes ?? []).length === 0 ? (
                                <p className="text-sm text-muted-foreground">Loading cakes...</p>
                              ) : (
                                (cakes ?? []).map((cake) => {
                                  const checked = field.value?.includes(cake.slug) ?? false;
                                  return (
                                    <label key={cake.id} className="flex items-start gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(nextChecked) => {
                                          const nextValues = nextChecked
                                            ? [...(field.value ?? []), cake.slug]
                                            : (field.value ?? []).filter((slug) => slug !== cake.slug);
                                          field.onChange(nextValues);
                                        }}
                                        className="mt-0.5"
                                      />
                                      <span className="min-w-0">
                                        <span className="block text-sm font-medium">{cake.name}</span>
                                        <span className="block text-xs text-muted-foreground">/{cake.slug}</span>
                                      </span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={promoForm.control}
                        name="showInStrip"
                        render={({ field }) => (
                          <FormItem className="flex min-h-10 flex-row items-center justify-between rounded-md border px-3 py-2">
                            <div>
                              <FormLabel>Show in Promo Strip</FormLabel>
                              <p className="text-xs text-muted-foreground">Public offers appear on the homepage ticker.</p>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={promoForm.control}
                        name="active"
                        render={({ field }) => (
                          <FormItem className="flex min-h-10 flex-row items-center justify-between rounded-md border px-3 py-2">
                            <div>
                              <FormLabel>Active</FormLabel>
                              <p className="text-xs text-muted-foreground">Inactive promos are hidden and will not apply at checkout.</p>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={promoForm.control}
                        name="startsAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Starts</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={promoForm.control}
                        name="endsAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ends</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={createPromo.isPending || updatePromo.isPending}>
                        {editingPromo ? "Save Changes" : "Create Promotion"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <PromotionList
            isLoading={isLoadingPromotions}
            promotions={promotions ?? []}
            cakeNameBySlug={cakeNameBySlug}
            onEdit={handleEditPromo}
            onDelete={handleDeletePromo}
            onToggleActive={togglePromoActive}
          />
        </TabsContent>

        <TabsContent value="blog" className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Blog</h2>
              <p className="text-sm text-muted-foreground">{publishedCount} published of {blogPosts?.length ?? 0} posts</p>
            </div>

            <Dialog open={isBlogDialogOpen} onOpenChange={(open) => {
              setIsBlogDialogOpen(open);
              if (!open) resetBlogDialog();
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" /> New Post
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto p-4 sm:p-6">
                <DialogHeader>
                  <DialogTitle>{editingPost ? "Edit Blog Post" : "Create Blog Post"}</DialogTitle>
                </DialogHeader>
                <Form {...blogForm}>
                  <form onSubmit={blogForm.handleSubmit(handleBlogSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={blogForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="How to choose a birthday cake"
                                {...field}
                                onChange={(event) => {
                                  field.onChange(event);
                                  if (!editingPost && !blogForm.getValues("slug")) {
                                    blogForm.setValue("slug", slugify(event.target.value), { shouldDirty: true, shouldValidate: true });
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={blogForm.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slug</FormLabel>
                            <FormControl><Input placeholder="birthday-cake-guide" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={blogForm.control}
                      name="excerpt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Excerpt</FormLabel>
                          <FormControl><Textarea placeholder="A short preview shown on the blog page..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={blogForm.control}
                      name="coverImageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cover Image</FormLabel>
                          <AdminImageUpload
                            label="Blog cover"
                            folder="blog"
                            value={field.value || ""}
                            onChange={(url) => field.onChange(url)}
                            onClear={() => field.onChange("")}
                            helperText="Upload one image for the article cover."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={blogForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content</FormLabel>
                          <FormControl><Textarea className="min-h-56" placeholder="Write the post..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={blogForm.control}
                        name="published"
                        render={({ field }) => (
                          <FormItem className="flex min-h-10 flex-row items-center justify-between rounded-md border px-3 py-2">
                            <FormLabel>Published</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={blogForm.control}
                        name="publishedAt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Publish Date</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end pt-2">
                      <Button type="submit" disabled={createBlogPost.isPending || updateBlogPost.isPending}>
                        {editingPost ? "Save Changes" : "Create Post"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <BlogPostList
            isLoading={isLoadingBlog}
            posts={blogPosts ?? []}
            onEdit={handleEditBlogPost}
            onDelete={handleDeleteBlogPost}
            onTogglePublished={toggleBlogPublished}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cleanBlogPayload(values: BlogFormValues) {
  return {
    title: values.title.trim(),
    slug: values.slug.trim(),
    excerpt: values.excerpt?.trim() || undefined,
    content: values.content.trim(),
    coverImageUrl: values.coverImageUrl?.trim() || undefined,
    published: values.published,
    publishedAt: values.published ? values.publishedAt || new Date().toISOString() : undefined,
  };
}

function PromotionList({
  isLoading,
  promotions,
  cakeNameBySlug,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  isLoading: boolean;
  promotions: Promotion[];
  cakeNameBySlug: Map<string, string>;
  onEdit: (promo: Promotion) => void;
  onDelete: (id: number) => void;
  onToggleActive: (promo: Promotion) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {promotions.length === 0 ? (
          <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">No promotions found.</div>
        ) : (
          promotions.map((promo) => (
            <div key={promo.id} className="rounded-md border bg-card p-4">
              <div className="flex gap-3">
                {promo.bannerUrl && <img src={promo.bannerUrl} alt="" className="h-16 w-20 shrink-0 rounded-md object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium">{promo.title}</h3>
                    <Badge variant={promo.active ? "default" : "outline"}>{promo.active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{describePromotion(promo, cakeNameBySlug)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {promo.startsAt || promo.endsAt ? `${formatShortDate(promo.startsAt)} - ${formatShortDate(promo.endsAt)}` : "Always"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={promo.active} onCheckedChange={() => onToggleActive(promo)} />
                  <span className="text-sm text-muted-foreground">{formatOffer(promo)}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(promo)} aria-label="Edit promotion">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <DeleteButton title="Delete Promotion" description={`This will permanently delete ${promo.title}.`} onDelete={() => onDelete(promo.id)} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead>Applies To</TableHead>
              <TableHead>Public</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No promotions found.</TableCell>
              </TableRow>
            ) : (
              promotions.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {promo.bannerUrl && <img src={promo.bannerUrl} alt="" className="h-10 w-14 rounded-md object-cover" />}
                      <div className="min-w-0">
                        <p className="truncate">{promo.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{promo.code ? `Code ${promo.code}` : "Automatic"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground">{describePromotion(promo, cakeNameBySlug)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatPromotionScope(promo, cakeNameBySlug)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={promo.showInStrip ? "default" : "outline"}>{promo.showInStrip ? "Public" : "Private"}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={promo.active} onCheckedChange={() => onToggleActive(promo)} />
                      <span className="text-sm text-muted-foreground">{promo.active ? "Active" : "Inactive"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(promo)} aria-label="Edit promotion">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DeleteButton title="Delete Promotion" description={`This will permanently delete ${promo.title}.`} onDelete={() => onDelete(promo.id)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function formatMoney(value: number) {
  return `KES ${value.toLocaleString()}`;
}

function humanizeSlug(value: string) {
  return value.replace(/-/g, " ");
}

function formatOffer(promo: Promotion) {
  if (promo.discountAmount != null) {
    return `${formatMoney(promo.discountAmount)} off`;
  }
  if (promo.discountPct != null) {
    return `${promo.discountPct}% off`;
  }
  return "No discount";
}

function formatPromotionScope(promo: Promotion, cakeNameBySlug: Map<string, string>) {
  if (promo.applicableCakeSlugs && promo.applicableCakeSlugs.length > 0) {
    return promo.applicableCakeSlugs
      .map((slug) => cakeNameBySlug.get(slug) ?? humanizeSlug(slug))
      .join(", ");
  }
  if (promo.minimumOrderAmount != null) {
    return `Orders of ${formatMoney(promo.minimumOrderAmount)} or more`;
  }
  return "All cakes in cart";
}

function describePromotion(promo: Promotion, cakeNameBySlug: Map<string, string>) {
  if (promo.code) {
    return `Use code ${promo.code} to get ${formatOffer(promo)} ${promo.applicableCakeSlugs?.length ? `on ${formatPromotionScope(promo, cakeNameBySlug)}` : promo.minimumOrderAmount != null ? `on ${formatPromotionScope(promo, cakeNameBySlug).toLowerCase()}` : "on your order"}.`;
  }

  if (promo.description) {
    return promo.description;
  }

  return `Get ${formatOffer(promo)} ${promo.applicableCakeSlugs?.length ? `on ${formatPromotionScope(promo, cakeNameBySlug)}` : promo.minimumOrderAmount != null ? `on ${formatPromotionScope(promo, cakeNameBySlug).toLowerCase()}` : "on your order"}.`;
}

function BlogPostList({
  isLoading,
  posts,
  onEdit,
  onDelete,
  onTogglePublished,
}: {
  isLoading: boolean;
  posts: BlogPost[];
  onEdit: (post: BlogPost) => void;
  onDelete: (id: number) => void;
  onTogglePublished: (post: BlogPost) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {posts.length === 0 ? (
          <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">No blog posts found.</div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="rounded-md border bg-card p-4">
              <div className="flex gap-3">
                {post.coverImageUrl && <img src={post.coverImageUrl} alt="" className="h-16 w-20 shrink-0 rounded-md object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium">{post.title}</h3>
                    <Badge variant={post.published ? "default" : "outline"}>{post.published ? "Live" : "Draft"}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.excerpt || "No excerpt"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">/{post.slug}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch checked={post.published} onCheckedChange={() => onTogglePublished(post)} />
                  <span className="text-sm text-muted-foreground">{post.publishedAt ? formatShortDate(post.publishedAt) : "Unscheduled"}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" asChild aria-label="Open blog post">
                    <Link href={`~/blog/${post.slug}`}><ExternalLink className="h-4 w-4" /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(post)} aria-label="Edit blog post">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <DeleteButton title="Delete Blog Post" description={`This will permanently delete ${post.title}.`} onDelete={() => onDelete(post.id)} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-md border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No blog posts found.</TableCell>
              </TableRow>
            ) : (
              posts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {post.coverImageUrl && <img src={post.coverImageUrl} alt="" className="h-10 w-14 rounded-md object-cover" />}
                      <div className="min-w-0">
                        <p className="truncate">{post.title}</p>
                        <p className="max-w-[320px] truncate text-xs text-muted-foreground">{post.excerpt || "No excerpt"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">/{post.slug}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{post.publishedAt ? formatShortDate(post.publishedAt) : "Unscheduled"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={post.published} onCheckedChange={() => onTogglePublished(post)} />
                      <Badge variant={post.published ? "default" : "outline"}>{post.published ? "Live" : "Draft"}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild aria-label="Open blog post">
                        <Link href={`~/blog/${post.slug}`}><ExternalLink className="h-4 w-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onEdit(post)} aria-label="Edit blog post">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DeleteButton title="Delete Blog Post" description={`This will permanently delete ${post.title}.`} onDelete={() => onDelete(post.id)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function DeleteButton({ title, description, onDelete }: { title: string; description: string; onDelete: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={title}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
