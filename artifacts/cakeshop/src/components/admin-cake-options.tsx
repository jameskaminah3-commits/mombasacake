import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchCakeOptions, saveCakeOptions, type CakeFlavour } from "@/lib/cake-options";

// Store-wide flavour list: customers must pick one on every cake page (the question is hidden when empty).
export function AdminCakeOptions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["cake-options"], queryFn: fetchCakeOptions });
  const [flavours, setFlavours] = useState<CakeFlavour[]>([]);
  const [secondFlavourMinKg, setSecondFlavourMinKg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setFlavours(data.flavours);
      setSecondFlavourMinKg(data.secondFlavourMinKg == null ? "" : String(data.secondFlavourMinKg));
    }
  }, [data]);

  const updateFlavour = (index: number, changes: Partial<CakeFlavour>) =>
    setFlavours((current) => current.map((flavour, i) => (i === index ? { ...flavour, ...changes } : flavour)));

  const handleSave = async () => {
    const cleaned = flavours
      .map((flavour) => ({ name: flavour.name.trim(), description: flavour.description.trim() }))
      .filter((flavour) => flavour.name);
    const minKgText = secondFlavourMinKg.trim().replace(",", ".");
    const minKg = minKgText ? Number(minKgText) : null;
    if (minKg !== null && !(minKg > 0 && minKg <= 100)) {
      toast({ title: "Check the second flavour size", description: "Enter a size in kg, e.g. 3, or leave it empty.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveCakeOptions({ flavours: cleaned, secondFlavourMinKg: minKg });
      queryClient.setQueryData(["cake-options"], saved);
      setFlavours(saved.flavours);
      setSecondFlavourMinKg(saved.secondFlavourMinKg == null ? "" : String(saved.secondFlavourMinKg));
      toast({ title: "Flavours saved", description: `${saved.flavours.length} flavour${saved.flavours.length === 1 ? "" : "s"} on the cake pages.` });
    } catch {
      toast({ title: "Could not save flavours", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-md border bg-card p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Cake flavours</h2>
          <p className="text-sm text-muted-foreground">
            Customers choose one of these on every cake page. Leave the list empty to skip the flavour question.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading flavours…</p>
        ) : flavours.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flavours yet.</p>
        ) : (
          flavours.map((flavour, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]">
              <Input
                value={flavour.name}
                onChange={(e) => updateFlavour(index, { name: e.target.value })}
                placeholder="Flavour, e.g. Vanilla"
                maxLength={60}
                aria-label={`Flavour ${index + 1} name`}
              />
              <Input
                value={flavour.description}
                onChange={(e) => updateFlavour(index, { description: e.target.value })}
                placeholder="Optional details, e.g. Vanilla sponge + buttercream"
                maxLength={120}
                aria-label={`Flavour ${index + 1} description`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setFlavours((current) => current.filter((_, i) => i !== index))}
                aria-label={`Remove flavour ${index + 1}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-3"
        onClick={() => setFlavours((current) => [...current, { name: "", description: "" }])}
        disabled={flavours.length >= 40}
      >
        <Plus className="mr-2 h-4 w-4" /> Add flavour
      </Button>

      <div className="mt-4 border-t pt-4">
        <Label htmlFor="second-flavour-min-kg" className="font-semibold">
          Second flavour for bigger cakes
        </Label>
        <p className="text-sm text-muted-foreground">
          Let customers add an optional second flavour (for example one per tier) on cakes of this size and above. Leave empty to turn it off.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            id="second-flavour-min-kg"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={100}
            step={0.5}
            value={secondFlavourMinKg}
            onChange={(e) => setSecondFlavourMinKg(e.target.value)}
            placeholder="e.g. 3"
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">kg and above</span>
        </div>
      </div>

      <Button type="button" className="mt-4" onClick={handleSave} disabled={saving || isLoading}>
        {saving ? "Saving…" : "Save flavours"}
      </Button>
    </section>
  );
}
