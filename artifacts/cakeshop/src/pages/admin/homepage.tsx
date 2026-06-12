import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  DEFAULT_HOMEPAGE_HERO,
  fetchHomepageHero,
  saveHomepageHero,
} from "@/lib/homepage-hero";
import {
  DEFAULT_HOMEPAGE_GALLERY,
  fetchHomepageGallery,
  saveHomepageGallery,
} from "@/lib/homepage-gallery";
import { normalizeSupabaseMediaUrl } from "@/lib/supabase-media";
import { AdminImageUpload } from "@/components/admin-image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Plus, Sparkles, Trash2 } from "lucide-react";

const heroSlideSchema = z.object({
  title: z.string().min(2, "Title is required"),
  label: z.string().min(2, "Label is required"),
  accent: z.string().min(2, "Description is required"),
  imageUrl: z.string().min(1, "Image is required"),
});

const heroSchema = z.object({
  brandLine: z.string().min(2, "Brand line is required"),
  headline: z.string().min(2, "Headline is required"),
  description: z.string().min(2, "Description is required"),
  slides: z.array(heroSlideSchema).min(1, "Add at least one hero slide"),
});

const galleryItemSchema = z.object({
  label: z.string().min(2, "Label is required"),
  imageUrl: z.string().min(1, "Image is required"),
});

const gallerySchema = z.object({
  items: z.array(galleryItemSchema).min(1, "Add at least one gallery item"),
});

type HeroFormValues = z.infer<typeof heroSchema>;
type GalleryFormValues = z.infer<typeof gallerySchema>;

const defaultFormValues: HeroFormValues = DEFAULT_HOMEPAGE_HERO;
const defaultGalleryValues: GalleryFormValues = DEFAULT_HOMEPAGE_GALLERY;

const createHeroSlide = () => ({
  title: "",
  label: "",
  accent: "",
  imageUrl: "",
});

const createGalleryItem = () => ({
  label: "",
  imageUrl: "",
});

export default function AdminHomepage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const form = useForm<HeroFormValues>({
    resolver: zodResolver(heroSchema),
    defaultValues: defaultFormValues,
  });
  const galleryForm = useForm<GalleryFormValues>({
    resolver: zodResolver(gallerySchema),
    defaultValues: defaultGalleryValues,
  });
  const heroSlidesFieldArray = useFieldArray({
    control: form.control,
    name: "slides",
  });
  const galleryItemsFieldArray = useFieldArray({
    control: galleryForm.control,
    name: "items",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["homepage-hero"],
    queryFn: fetchHomepageHero,
  });
  const { data: galleryData, isLoading: galleryLoading } = useQuery({
    queryKey: ["homepage-gallery"],
    queryFn: fetchHomepageGallery,
  });

  const saveMutation = useMutation({
    mutationFn: (values: HeroFormValues) => saveHomepageHero(token, values),
    onSuccess: (saved) => {
      form.reset(saved);
      toast({ title: "Homepage hero updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update homepage hero",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });
  const saveGalleryMutation = useMutation({
    mutationFn: (values: GalleryFormValues) => saveHomepageGallery(token, values),
    onSuccess: (saved) => {
      galleryForm.reset(saved);
      toast({ title: "Homepage gallery updated" });
    },
    onError: (error) => {
      toast({
        title: "Failed to update homepage gallery",
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
  useEffect(() => {
    if (galleryData) {
      galleryForm.reset(galleryData);
    }
  }, [galleryData, galleryForm]);

  const values = form.watch();
  const previewSlide = values.slides[0] ?? DEFAULT_HOMEPAGE_HERO.slides[0];
  const galleryValues = galleryForm.watch();
  const previewGalleryItem = galleryValues.items[0] ?? DEFAULT_HOMEPAGE_GALLERY.items[0];
  const heroSlideCount = heroSlidesFieldArray.fields.length;
  const galleryItemCount = galleryItemsFieldArray.fields.length;

  const handleSubmit = async (values: HeroFormValues) => {
    await saveMutation.mutateAsync(values);
  };
  const handleGallerySubmit = async (values: GalleryFormValues) => {
    await saveGalleryMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Homepage Content</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the rotating hero and the dedicated Homepage Gallery used on the storefront.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Changes publish immediately after saving
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-muted/20 px-4 py-3 text-sm">
        <span className="font-medium text-foreground">Jump to:</span>
        <a
          href="#homepage-hero"
          className="rounded-full border bg-background px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Hero Editor
        </a>
        <a
          href="#homepage-gallery"
          className="rounded-full border bg-background px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Homepage Gallery
        </a>
      </div>

      <Card id="homepage-gallery" className="scroll-mt-24 border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Homepage Gallery</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                These images drive the <span className="font-medium text-foreground">Our Work Speaks</span> rail on the storefront.
                Uploads are stored in Supabase and publish immediately after saving.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => galleryItemsFieldArray.append(createGalleryItem())}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add item
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Current items: {galleryItemCount}
          </p>
        </CardHeader>
        <CardContent>
          {galleryLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <Form {...galleryForm}>
              <form onSubmit={galleryForm.handleSubmit(handleGallerySubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {galleryItemsFieldArray.fields.map((field, index) => {
                    const item = galleryValues.items[index];
                    return (
                    <div key={field.id} className="rounded-2xl border bg-muted/20 p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">Gallery item {index + 1}</p>
                          <p className="text-xs text-muted-foreground">Edit the image and label for this work tile.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                            <ImageIcon className="h-3.5 w-3.5" />
                            {item?.imageUrl ? "Image set" : "No image"}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
                            onClick={() => galleryItemsFieldArray.remove(index)}
                            disabled={galleryItemsFieldArray.fields.length <= 1}
                            aria-label={`Remove gallery item ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <FormField
                          control={galleryForm.control}
                          name={`items.${index}.label`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Label</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Butterfly Birthday" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={galleryForm.control}
                          name={`items.${index}.imageUrl`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Gallery image</FormLabel>
                              <AdminImageUpload
                                label={`Gallery item ${index + 1} image`}
                                folder="homepage-gallery"
                                value={field.value}
                                onChange={(url) => field.onChange(url)}
                                onClear={() => field.onChange("")}
                                helperText="Reuse an existing upload from Supabase or upload a new one."
                                defaultLibraryScope="all"
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]">
                  <div className="overflow-hidden rounded-2xl border bg-[#170c10] text-white shadow-xl shadow-black/10">
                    <div className="relative aspect-[4/5] w-full">
                      <img
                        src={previewGalleryItem.imageUrl}
                        alt={previewGalleryItem.label}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,12,16,0.12)_0%,rgba(23,12,16,0.82)_100%)]" />
                      <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-white/70">
                          Homepage Gallery
                        </p>
                        <p className="mt-2 font-serif text-2xl font-bold leading-tight">{previewGalleryItem.label}</p>
                        <p className="mt-2 text-sm leading-6 text-white/75">
                          This preview reflects the first tile in the rail. The storefront uses every saved item in order.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-muted/20 p-5">
                    <div className="space-y-3">
                      <h3 className="text-base font-semibold">Editing Notes</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Keep each image distinct so the storefront rail stays visually varied. The uploads are normalized to
                        Supabase bucket URLs, so the homepage will always load the same storage-backed paths you save here.
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        If you replace an image in a tile, the homepage updates after saving without needing any other changes.
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={saveGalleryMutation.isPending} className="min-w-36">
                        {saveGalleryMutation.isPending ? "Saving..." : "Save Gallery"}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <div id="homepage-hero" className="scroll-mt-24 grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Hero Content</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Edit the rotating hero content and add more slides when needed.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => heroSlidesFieldArray.append(createHeroSlide())}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add slide
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Current slides: {heroSlideCount}
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-28 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="brandLine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Brand line</FormLabel>
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
                          <FormLabel>Headline</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Decadence in Every Bite" />
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
                          <Textarea
                            {...field}
                            placeholder="Describe the overall hero message shown on the homepage."
                            className="min-h-28"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Hero Slides
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Edit the saved slides and add more whenever the homepage needs extra rotation.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {heroSlidesFieldArray.fields.map((field, index) => {
                        const slide = values.slides[index];
                        return (
                          <div key={field.id} className="rounded-2xl border bg-muted/20 p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">Slide {index + 1}</p>
                              <p className="text-xs text-muted-foreground">Manage the image and captions for this frame.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                                <ImageIcon className="h-3.5 w-3.5" />
                                {slide?.imageUrl ? "Image set" : "No image"}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
                                onClick={() => heroSlidesFieldArray.remove(index)}
                                disabled={heroSlidesFieldArray.fields.length <= 1}
                                aria-label={`Remove hero slide ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                            <div className="space-y-4">
                              <FormField
                                control={form.control}
                                name={`slides.${index}.title`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Couture celebration cakes" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`slides.${index}.label`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Label</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="Signature artistry" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`slides.${index}.accent`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                      <Textarea
                                        {...field}
                                        placeholder="Short descriptive line shown beneath the title."
                                        className="min-h-24"
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>

                            <FormField
                              control={form.control}
                              name={`slides.${index}.imageUrl`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Hero image</FormLabel>
                                  <AdminImageUpload
                                    label={`Slide ${index + 1} image`}
                                    folder="homepage-hero"
                                    value={field.value}
                                    onChange={(url) => field.onChange(url)}
                                    onClear={() => field.onChange("")}
                                    helperText="Reuse an existing upload from Supabase or upload a new one."
                                    defaultLibraryScope="all"
                                  />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saveMutation.isPending} className="min-w-36">
                      {saveMutation.isPending ? "Saving..." : "Save Hero"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold">Live Preview</h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-3xl bg-[#170c10] text-white shadow-2xl shadow-black/20">
              <div className="relative aspect-[4/5] w-full">
                <img
                  src={
                    normalizeSupabaseMediaUrl(previewSlide.imageUrl || DEFAULT_HOMEPAGE_HERO.slides[0].imageUrl) ||
                    DEFAULT_HOMEPAGE_HERO.slides[0].imageUrl
                  }
                  alt={previewSlide.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,12,16,0.15)_0%,rgba(23,12,16,0.82)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 space-y-4 p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                    {values.brandLine}
                  </p>
                  <h3 className="font-serif text-3xl font-bold leading-tight">{values.headline}</h3>
                  <p className="text-sm leading-6 text-white/75">{values.description}</p>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">{previewSlide.label}</p>
                    <p className="mt-2 font-serif text-xl text-white">{previewSlide.title}</p>
                    <p className="mt-2 text-sm leading-6 text-white/75">{previewSlide.accent}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
