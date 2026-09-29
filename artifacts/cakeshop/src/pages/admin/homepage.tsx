import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Plus, Sparkles, Trash2 } from "lucide-react";
import { AdminHomepageHighlights } from "@/components/admin-homepage-highlights";
import { AdminImageUpload } from "@/components/admin-image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_HOMEPAGE_GALLERY, fetchHomepageGalleryForEditing, saveHomepageGallery } from "@/lib/homepage-gallery";
import { DEFAULT_HOMEPAGE_HERO, fetchHomepageHeroForEditing, saveHomepageHero } from "@/lib/homepage-hero";
import { DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";
import { normalizeSupabaseMediaUrl } from "@/lib/supabase-media";

const shopHeaderSchema = z
  .object({
    brandLine: z.string().trim().min(2, "Add your shop name"),
    headline: z.string().trim().min(2, "Add a short tagline"),
    description: z.string().trim().min(2, "Add a few words about your shop"),
    // The shop shows the first slide's photo as its cover photo. Older slides are kept as they are.
    slides: z.array(z.object({ title: z.string(), label: z.string(), accent: z.string(), imageUrl: z.string() })).min(1),
  })
  .refine((values) => Boolean(values.slides[0]?.imageUrl), { message: "Choose a cover photo", path: ["slides", 0, "imageUrl"] });

const gallerySchema = z.object({
  items: z
    .array(
      z.object({
        label: z.string().trim().min(2, "Add a short caption"),
        imageUrl: z.string().min(1, "Choose a photo"),
      }),
    )
    .min(1, "Add at least one photo"),
});

type ShopHeaderValues = z.infer<typeof shopHeaderSchema>;
type GalleryFormValues = z.infer<typeof gallerySchema>;

const SECTIONS = [
  { href: "#homepage-hero", label: "Shop header" },
  { href: "#homepage-selling-points", label: "Selling points" },
  { href: "#homepage-gallery", label: "Recent creations" },
];

function LoadError({ what, onRetry, retrying }: { what: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="rounded-xl border border-dashed p-4 text-sm">
      <p className="font-medium">Couldn't load the {what}.</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry} disabled={retrying}>
        {retrying ? "Trying again…" : "Try again"}
      </Button>
    </div>
  );
}

export default function AdminHomepage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Homepage Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything on the front page of your shop, from top to bottom.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Changes show on the shop as soon as you save
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/20 px-4 py-3 text-sm" aria-label="Homepage sections">
        <span className="font-medium text-foreground">Jump to:</span>
        {SECTIONS.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="rounded-full border bg-background px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <ShopHeaderEditor />
      <AdminHomepageHighlights />
      <RecentCreationsEditor />
    </div>
  );
}

// Cover photo, shop name and tagline at the top of the shop, and the About box at the bottom.
function ShopHeaderEditor() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<ShopHeaderValues>({
    resolver: zodResolver(shopHeaderSchema),
    defaultValues: DEFAULT_HOMEPAGE_HERO,
  });
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin", "homepage-hero"],
    queryFn: fetchHomepageHeroForEditing,
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: (values: ShopHeaderValues) => saveHomepageHero(token, values),
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin", "homepage-hero"], saved);
      queryClient.setQueryData(["homepage-hero"], saved);
      form.reset(saved);
      toast({ title: "Shop header saved" });
    },
    onError: (error) => {
      toast({
        title: "Could not save the shop header",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (data) {
      form.reset(data);
    }
  }, [data, form]);

  const values = form.watch();
  const cover = values.slides[0]?.imageUrl;
  const coverUrl = cover ? normalizeSupabaseMediaUrl(cover) || cover : "";

  return (
    <Card id="homepage-hero" className="scroll-mt-24 border-border/60">
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Shop header</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The cover photo, name and tagline at the top of the shop, and the About box at the bottom.
        </p>
      </CardHeader>
      <CardContent>
        {!data ? (
          isError ? (
            <LoadError what="shop header" onRetry={() => refetch()} retrying={isFetching} />
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((submitted) => saveMutation.mutate(submitted))} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="brandLine"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shop name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Channah Cake House" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="headline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tagline</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Decadence in Every Bite" />
                        </FormControl>
                        <FormDescription>One short line under the name.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="slides.0.imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cover photo</FormLabel>
                      <AdminImageUpload
                        label="Cover photo"
                        folder="homepage-hero"
                        value={field.value}
                        onChange={(url) => field.onChange(url)}
                        onClear={() => field.onChange("")}
                        helperText="The wide photo across the top of the shop. Landscape photos work best."
                        defaultLibraryScope="all"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>About your shop</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="A few words about your cakes and your shop." className="min-h-28" />
                      </FormControl>
                      <FormDescription>Shown in the About box at the bottom of the shop.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={saveMutation.isPending} className="min-w-36">
                  {saveMutation.isPending ? "Saving…" : "Save shop header"}
                </Button>
              </form>
            </Form>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview on a phone</p>
              <div className="mx-auto mt-2 max-w-sm space-y-3 rounded-2xl border bg-background p-3">
                <div className="text-center">
                  <div className="h-28 overflow-hidden rounded-2xl bg-muted">
                    {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="relative mx-auto -mt-12 h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-white shadow-md">
                    <img src={DEFAULT_LOGO_IMAGE_URL} alt="" className="h-full w-full object-contain p-2" />
                  </div>
                  <p className="mt-2 text-xl font-extrabold tracking-tight">{values.brandLine}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{values.headline}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  Cakes, photos and reviews
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="rounded-2xl border bg-card p-4">
                  <p className="text-base font-bold tracking-tight">About {values.brandLine}</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-muted-foreground">{values.description}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Photos in the "Recent creations" row near the bottom of the shop.
function RecentCreationsEditor() {
  const { token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<GalleryFormValues>({
    resolver: zodResolver(gallerySchema),
    defaultValues: DEFAULT_HOMEPAGE_GALLERY,
  });
  const items = useFieldArray({ control: form.control, name: "items" });
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin", "homepage-gallery"],
    queryFn: fetchHomepageGalleryForEditing,
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: (values: GalleryFormValues) => saveHomepageGallery(token, values),
    onSuccess: (saved) => {
      queryClient.setQueryData(["admin", "homepage-gallery"], saved);
      queryClient.setQueryData(["homepage-gallery"], saved);
      form.reset(saved);
      toast({ title: "Photos saved" });
    },
    onError: (error) => {
      toast({
        title: "Could not save the photos",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (data) {
      form.reset(data);
    }
  }, [data, form]);

  const values = form.watch();

  return (
    <Card id="homepage-gallery" className="scroll-mt-24 border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Recent creations</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Photos of your work in the Recent creations row near the bottom of the shop, in this order.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => items.append({ label: "", imageUrl: "" })}
            className="gap-2"
            disabled={!data}
          >
            <Plus className="h-4 w-4" />
            Add photo
          </Button>
        </div>
        {data && <p className="mt-2 text-xs text-muted-foreground">Photos: {items.fields.length}</p>}
      </CardHeader>
      <CardContent>
        {!data ? (
          isError ? (
            <LoadError what="photos" onRetry={() => refetch()} retrying={isFetching} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-2xl" />
              ))}
            </div>
          )
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((submitted) => saveMutation.mutate(submitted))} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {items.fields.map((field, index) => (
                  <div key={field.id} className="rounded-2xl border bg-muted/20 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="font-medium">Photo {index + 1}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                          <ImageIcon className="h-3.5 w-3.5" />
                          {values.items[index]?.imageUrl ? "Photo set" : "No photo"}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
                          onClick={() => items.remove(index)}
                          disabled={items.fields.length <= 1}
                          aria-label={`Remove photo ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name={`items.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Caption</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Butterfly Birthday" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`items.${index}.imageUrl`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Photo</FormLabel>
                            <AdminImageUpload
                              label={`Photo ${index + 1}`}
                              folder="homepage-gallery"
                              value={field.value}
                              onChange={(url) => field.onChange(url)}
                              onClear={() => field.onChange("")}
                              helperText="Upload a new photo or reuse one you've uploaded before."
                              defaultLibraryScope="all"
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending} className="min-w-36">
                  {saveMutation.isPending ? "Saving…" : "Save photos"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
