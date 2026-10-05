import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/customer";
import { fetchPaymentSettings, savePaymentSettings, type PaymentSettings } from "@/lib/payment-settings";

// Where customers pay (till or paybill) and whether the shop also sends M-Pesa prompts (STK push).
export function AdminPaymentSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isError, refetch } = useQuery({ queryKey: ["payment-settings"], queryFn: fetchPaymentSettings, staleTime: 0 });
  const [draft, setDraft] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDraft({
      displayName: data.displayName,
      businessShortCode: data.businessShortCode,
      tillNumber: data.tillNumber,
      transactionType: data.transactionType,
      accountReferencePrefix: data.accountReferencePrefix,
      instructions: data.instructions,
      stkEnabled: data.stkSetting,
    });
  }, [data]);

  if (isError) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-sm">
        Couldn't load the payment settings.{" "}
        <button type="button" onClick={() => refetch()} className="font-medium text-primary underline">
          Try again
        </button>
      </div>
    );
  }
  if (!data || !draft) return <Skeleton className="h-72 w-full rounded-2xl" />;

  const isTill = draft.transactionType === "CustomerBuyGoodsOnline";
  const update = (changes: Partial<PaymentSettings>) => setDraft({ ...draft, ...changes });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await savePaymentSettings(draft);
      queryClient.setQueryData(["payment-settings"], saved);
      await queryClient.invalidateQueries({ queryKey: ["payment-details"] });
      toast({ title: "Payment settings saved", description: "Checkout shows them now." });
    } catch (error) {
      toast({ title: "Couldn't save the payment settings", description: errorMessage(error, "Please check the numbers and try again."), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold tracking-tight">How customers pay</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Customers pay from their phone's M-Pesa menu and send you the M-Pesa code from their SMS. Check the code in your M-Pesa messages, then press{" "}
          <strong>Mark paid</strong> on the order in Orders.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Customers pay with</Label>
          <Select value={draft.transactionType} onValueChange={(transactionType) => update({ transactionType })}>
            <SelectTrigger aria-label="Customers pay with">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CustomerBuyGoodsOnline">Till (Buy Goods and Services)</SelectItem>
              <SelectItem value="CustomerPayBillOnline">Paybill</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isTill ? (
          <div className="space-y-2">
            <Label htmlFor="pay-till">Till number</Label>
            <Input id="pay-till" inputMode="numeric" value={draft.tillNumber} onChange={(event) => update({ tillNumber: event.target.value.replace(/\D/g, "") })} placeholder="e.g. 5123456" />
            <p className="text-xs text-muted-foreground">The number customers enter under Buy Goods and Services.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="pay-paybill">Paybill number</Label>
              <Input id="pay-paybill" inputMode="numeric" value={draft.businessShortCode} onChange={(event) => update({ businessShortCode: event.target.value.replace(/\D/g, "") })} placeholder="e.g. 522522" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-account">Account number starts with</Label>
              <Input id="pay-account" value={draft.accountReferencePrefix} onChange={(event) => update({ accountReferencePrefix: event.target.value })} />
              <p className="text-xs text-muted-foreground">
                Customers enter it with their order number, e.g. {draft.accountReferencePrefix || "Order"}-42.
              </p>
            </div>
          </>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="pay-instructions">Extra note for customers (optional)</Label>
          <Textarea id="pay-instructions" rows={2} value={draft.instructions} onChange={(event) => update({ instructions: event.target.value })} placeholder="e.g. The till is registered as Channah Cake House." />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Also send an M-Pesa prompt to the customer's phone (STK push)</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {data.stkConfigured
                ? "Ready: the M-Pesa keys are set up on the server. When this is on, customers get a PIN prompt at checkout; paying from the M-Pesa menu still works."
                : "Not ready yet: the M-Pesa (Daraja) keys aren't set up on the server. Customers pay from the M-Pesa menu until the keys are added in Railway."}
            </p>
          </div>
          <Switch
            checked={draft.stkEnabled}
            onCheckedChange={(stkEnabled) => update({ stkEnabled })}
            disabled={!data.stkConfigured && !draft.stkEnabled}
            aria-label="Send an M-Pesa prompt to the customer's phone"
          />
        </div>
        {isTill && (draft.stkEnabled || data.darajaKeys) && (
          <div className="space-y-2">
            <Label htmlFor="pay-store">Store / head office number</Label>
            <Input id="pay-store" inputMode="numeric" value={draft.businessShortCode} onChange={(event) => update({ businessShortCode: event.target.value.replace(/\D/g, "") })} />
            <p className="text-xs text-muted-foreground">
              Safaricom's head office number for your till, used for the prompt and automatic confirmation. Customers don't see it.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={saving} className="h-11 rounded-full bg-[#52B44B] px-6 text-white hover:bg-[#52B44B]/90">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save payment settings
        </Button>
      </div>
    </div>
  );
}
