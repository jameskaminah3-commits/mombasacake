import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { AdminImageUpload } from "@/components/admin-image-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Image as ImageIcon, Sparkles } from "lucide-react";

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
  slides: z.array(heroSlideSchema).length(4, "Add exactly four hero slides"),
});

type HeroFormValues = z.infer<typeof heroSchema>;

const defaultFormValues: HeroFormValues = DEFAULT_HOMEPAGE_HERO;

export default function AdminHomepage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const form = useForm<HeroFormValues>({
    resolver: zodResolver(heroSchema),
    defaultValues: defaultFormValues,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["homepage-hero"],
    queryFn: fetchHomepageHero,
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

  useEffect(() => {
    if (data) {
      form.reset(data);
    }
  }, [data, form]);

  const values = form.watch();
  const previewSlide = values.slides[0] ?? DEFAULT_HOMEPAGE_HERO.slides[0];

  const handleSubmit = async (values: HeroFormValues) => {
    await saveMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Homepage Hero</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the hero headline, supporting description, and the four showcase images on the storefront.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          Changes publish immediately after saving
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold">Hero Content</h2>
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
                        Edit four images and their captions. These power the rotating hero on the storefront.
                      </p>
                    </div>

                    <div className="space-y-4">
                      {values.slides.map((slide, index) => (
                        <div key={index} className="rounded-2xl border bg-muted/20 p-4">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">Slide {index + 1}</p>
                              <p className="text-xs text-muted-foreground">Manage the image and captions for this frame.</p>
                            </div>
                            <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs text-muted-foreground">
                              <ImageIcon className="h-3.5 w-3.5" />
                              {slide.imageUrl ? "Image set" : "No image"}
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
                                    helperText="Use a strong, high-contrast image for the rotating hero."
                                  />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                      ))}
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
                  src={previewSlide.imageUrl || DEFAULT_HOMEPAGE_HERO.slides[0].imageUrl}
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
