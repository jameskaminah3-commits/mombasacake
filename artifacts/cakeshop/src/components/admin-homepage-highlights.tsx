import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { CustomCakeButton, HighlightsRow } from "@/components/homepage-selling-points";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  HIGHLIGHT_ICONS,
  HIGHLIGHT_LABEL_MAX,
  MAX_HIGHLIGHTS,
  fetchHomepageHighlightsForEditing,
  highlightIcon,
  saveHomepageHighlights,
  type Highlight,
  type HomepageHighlights,
} from "@/lib/homepage-highlights";

// Picture, text and remove button for each selling point.
const ROW = "grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto]";

function errorMessage(error: unknown) {
  const data = (error as { data?: { error?: unknown } } | null)?.data;
  if (typeof data?.error === "string") return data.error;
  return error instanceof Error ? error.message : "Please try again.";
}

// The benefits row under the category photos and the WhatsApp custom-cake button on the shop's front page.
export function AdminHomepageHighlights() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["admin", "homepage-highlights"],
    queryFn: fetchHomepageHighlightsForEditing,
    staleTime: 0,
  });
  const [draft, setDraft] = useState<HomepageHighlights | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const update = (changes: Partial<HomepageHighlights>) => setDraft((current) => (current ? { ...current, ...changes } : current));
  const updateHighlight = (index: number, changes: Partial<Highlight>) =>
    setDraft((current) =>
      current ? { ...current, highlights: current.highlights.map((item, i) => (i === index ? { ...item, ...changes } : item)) } : current,
    );

  const handleSave = async () => {
    if (!draft) return;
    const cleaned: HomepageHighlights = {
      ...draft,
      highlights: draft.highlights.map((item) => ({ ...item, label: item.label.trim() })).filter((item) => item.label),
      customCakeTitle: draft.customCakeTitle.trim(),
      customCakeText: draft.customCakeText.trim(),
    };
    if (!cleaned.customCakeTitle) {
      toast({ title: "Add a title for the WhatsApp button", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveHomepageHighlights(cleaned);
      queryClient.setQueryData(["admin", "homepage-highlights"], saved);
      queryClient.setQueryData(["homepage-highlights"], saved);
      setDraft(saved);
      toast({ title: "Selling points saved", description: "The shop shows them now." });
    } catch (error) {
      toast({ title: "Could not save the selling points", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const previewHighlights = draft?.highlights.filter((item) => item.label.trim()) ?? [];

  return (
    <Card id="homepage-selling-points" className="scroll-mt-24 border-border/60">
      <CardHeader className="pb-3">
        <h2 className="text-lg font-semibold">Selling points</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Short reasons to order from you, under the category photos, and the WhatsApp button for customers who have their own design.
        </p>
      </CardHeader>
      <CardContent>
        {!draft ? (
          isError ? (
            <div className="rounded-xl border border-dashed p-4 text-sm">
              <p className="font-medium">Couldn't load the selling points.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? "Trying again…" : "Try again"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          )
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <section className="space-y-3" aria-labelledby="benefits-row-title">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="benefits-row-title" className="font-semibold">
                      Benefits row
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Up to {MAX_HIGHLIGHTS}. Two or three words each read best on phones.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      id="show-highlights"
                      checked={draft.showHighlights}
                      onCheckedChange={(checked) => update({ showHighlights: checked })}
                    />
                    <Label htmlFor="show-highlights">Show</Label>
                  </div>
                </div>

                {draft.highlights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No selling points yet.</p>
                ) : (
                  <div className={cn(ROW, "text-xs font-medium text-muted-foreground")} aria-hidden="true">
                    <span>Picture</span>
                    <span>Text</span>
                  </div>
                )}
                {draft.highlights.map((item, index) => {
                  const SelectedIcon = highlightIcon(item.icon);
                  return (
                    <div key={index} className={ROW}>
                      <Select value={item.icon} onValueChange={(icon) => updateHighlight(index, { icon })}>
                        <SelectTrigger aria-label={`Selling point ${index + 1} picture`}>
                          {/* Just the picture on phones, so the text box gets the room */}
                          <SelectValue>
                            <span className="flex min-w-0 items-center gap-2">
                              <SelectedIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                              <span className="hidden truncate sm:inline">{HIGHLIGHT_ICONS[item.icon]?.label}</span>
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(HIGHLIGHT_ICONS).map(([name, { icon: Icon, label }]) => (
                            <SelectItem key={name} value={name}>
                              <span className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                                {label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={item.label}
                        onChange={(e) => updateHighlight(index, { label: e.target.value })}
                        placeholder="e.g. Free delivery in town"
                        maxLength={HIGHLIGHT_LABEL_MAX}
                        aria-label={`Selling point ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => update({ highlights: draft.highlights.filter((_, i) => i !== index) })}
                        aria-label={`Remove selling point ${index + 1}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => update({ highlights: [...draft.highlights, { icon: "sparkles", label: "" }] })}
                  disabled={draft.highlights.length >= MAX_HIGHLIGHTS}
                >
                  <Plus className="mr-2 h-4 w-4" /> Add selling point
                </Button>
              </section>

              <section className="space-y-3 border-t pt-5" aria-labelledby="custom-cake-button-title">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="custom-cake-button-title" className="font-semibold">
                      WhatsApp button for custom cakes
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Shown after the first group of cakes. It opens WhatsApp with a message asking you for a quote.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      id="show-custom-cake-button"
                      checked={draft.showCustomCakeButton}
                      onCheckedChange={(checked) => update({ showCustomCakeButton: checked })}
                    />
                    <Label htmlFor="show-custom-cake-button">Show</Label>
                  </div>
                </div>
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-cake-title">Title</Label>
                    <Input
                      id="custom-cake-title"
                      value={draft.customCakeTitle}
                      onChange={(e) => update({ customCakeTitle: e.target.value })}
                      placeholder="Have a design in mind?"
                      maxLength={60}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-cake-text">Text (optional)</Label>
                    <Input
                      id="custom-cake-text"
                      value={draft.customCakeText}
                      onChange={(e) => update({ customCakeText: e.target.value })}
                      placeholder="Send us a photo on WhatsApp for a quote."
                      maxLength={120}
                    />
                  </div>
                </div>
              </section>

              <Button type="button" onClick={handleSave} disabled={saving} className="min-w-36">
                {saving ? "Saving…" : "Save selling points"}
              </Button>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview on a phone</p>
              <div className="mx-auto mt-2 max-w-sm space-y-3 rounded-2xl border bg-background p-3">
                {draft.showHighlights && previewHighlights.length > 0 ? (
                  <HighlightsRow highlights={previewHighlights} />
                ) : (
                  <p className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">Benefits row is hidden</p>
                )}
                {draft.showCustomCakeButton ? (
                  <CustomCakeButton preview title={draft.customCakeTitle.trim() || "Add a title"} text={draft.customCakeText.trim()} />
                ) : (
                  <p className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">WhatsApp button is hidden</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
