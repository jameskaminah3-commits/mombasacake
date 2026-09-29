import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { fetchCakeOptions, kgLabel, saveCakeOptions, type CakeFlavour } from "@/lib/cake-options";
import { formatKes } from "@/lib/utils";

const EXAMPLE_PRICE = 3000;

// Shop-wide cake choices: the flavours customers must pick from on every cake page (hidden when empty), and the
// standard sizes offered on cakes that have no sizes of their own.
export function AdminCakeOptions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["cake-options"], queryFn: fetchCakeOptions });
  const [flavours, setFlavours] = useState<CakeFlavour[]>([]);
  const [secondFlavourMinKg, setSecondFlavourMinKg] = useState("");
  const [sizes, setSizes] = useState<number[]>([]);
  const [newSize, setNewSize] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setFlavours(data.flavours);
      setSecondFlavourMinKg(data.secondFlavourMinKg == null ? "" : String(data.secondFlavourMinKg));
      setSizes(data.standardSizesKg);
    }
  }, [data]);

  const updateFlavour = (index: number, changes: Partial<CakeFlavour>) =>
    setFlavours((current) => current.map((flavour, i) => (i === index ? { ...flavour, ...changes } : flavour)));

  const addSize = () => {
    const kg = Number(newSize.trim().replace(",", "."));
    if (!(kg > 0 && kg <= 100)) {
      toast({ title: "Enter a size in kg", description: "For example 0.5, 1.5 or 5.", variant: "destructive" });
      return;
    }
    setSizes((current) => [...new Set([...current, kg])].sort((a, b) => a - b));
    setNewSize("");
  };

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
      const saved = await saveCakeOptions({ flavours: cleaned, secondFlavourMinKg: minKg, standardSizesKg: sizes });
      queryClient.setQueryData(["cake-options"], saved);
      setFlavours(saved.flavours);
      setSecondFlavourMinKg(saved.secondFlavourMinKg == null ? "" : String(saved.secondFlavourMinKg));
      setSizes(saved.standardSizesKg);
      toast({
        title: "Flavours and sizes saved",
        description: `${saved.flavours.length} flavour${saved.flavours.length === 1 ? "" : "s"}, ${saved.standardSizesKg.length} standard size${saved.standardSizesKg.length === 1 ? "" : "s"}.`,
      });
    } catch {
      toast({ title: "Could not save flavours and sizes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="cake-flavours-sizes" className="scroll-mt-24 rounded-md border bg-card p-4">
      <h2 className="text-lg font-semibold">Cake flavours and sizes</h2>
      <p className="text-sm text-muted-foreground">
        Customers choose one of these flavours on every cake page. Leave the list empty to skip the flavour question.
      </p>

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

      <div className="mt-4 border-t pt-4">
        <p className="font-semibold">Standard sizes</p>
        <p className="text-sm text-muted-foreground">
          Cakes without sizes of their own offer these, priced at the cake's price × kg, so a cake's price is its 1 kg price. A cake with its
          own sizes shows only those. Remove all sizes to turn this off.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Standard sizes">
          {sizes.length === 0 && <span className="text-sm text-muted-foreground">No standard sizes.</span>}
          {sizes.map((kg) => (
            <span key={kg} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 py-1 pl-3 pr-1 text-sm font-medium">
              {kgLabel(kg)}
              <button
                type="button"
                onClick={() => setSizes((current) => current.filter((size) => size !== kg))}
                aria-label={`Remove ${kgLabel(kg)}`}
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.5}
            max={100}
            step={0.5}
            value={newSize}
            onChange={(e) => setNewSize(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSize();
              }
            }}
            placeholder="e.g. 5"
            className="w-24"
            aria-label="New size in kg"
          />
          <span className="text-sm text-muted-foreground">kg</span>
          <Button type="button" variant="outline" size="sm" onClick={addSize} disabled={sizes.length >= 12}>
            <Plus className="mr-1 h-4 w-4" /> Add size
          </Button>
        </div>
        {sizes.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Example, a {formatKes(EXAMPLE_PRICE)} cake: {sizes.map((kg) => `${kgLabel(kg)} ${formatKes(Math.round(EXAMPLE_PRICE * kg))}`).join(" · ")}
          </p>
        )}
      </div>

      <Button type="button" className="mt-4" onClick={handleSave} disabled={saving || isLoading}>
        {saving ? "Saving…" : "Save flavours and sizes"}
      </Button>
    </section>
  );
}
