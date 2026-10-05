import { useState } from "react";
import type { Order, OrderPaymentCheck } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Copy, Loader2 } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/customer";
import { extractMpesaCode, sendPaymentCode, usePaymentDetails } from "@/lib/payment-details";
import { STORE_PHONE_DISPLAY, WHATSAPP_URL } from "@/lib/store-info";

const kes = (value: number) => `KES ${Math.ceil(value).toLocaleString()}`;

// Paying the shop's till (or paybill) from the M-Pesa menu, then sending the M-Pesa code from the SMS so the
// shop can confirm the payment. Works whether or not the shop sends M-Pesa prompts.
export function MpesaManualPayment({
  order,
  headers,
  onSent,
}: {
  order: Pick<Order, "id" | "total"> & { paymentCheck?: OrderPaymentCheck | null };
  headers: Record<string, string>;
  onSent?: (order: Order) => void;
}) {
  const { data: details, isLoading } = usePaymentDetails();
  const { toast } = useToast();
  const [check, setCheck] = useState<OrderPaymentCheck | null>(order.paymentCheck ?? null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (isLoading) return <Skeleton className="h-56 w-full rounded-xl" />;

  const number = details?.manual?.number;
  if (!details?.manual || !number) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-semibold">Pay with M-Pesa</p>
        <p className="mt-1 text-muted-foreground">
          WhatsApp us on {STORE_PHONE_DISPLAY} and we'll send you our M-Pesa details for order #{order.id}.
        </p>
        <Button asChild className="mt-3 rounded-full bg-[#25D366] text-white hover:bg-[#1fb958]">
          <a href={`${WHATSAPP_URL}?text=${encodeURIComponent(`Hi! I'd like to pay for order #${order.id} (${kes(order.total)}).`)}`} target="_blank" rel="noopener noreferrer">
            <SiWhatsapp className="mr-2 h-4 w-4" /> WhatsApp us
          </a>
        </Button>
      </div>
    );
  }

  const till = details.manual.method === "till";
  const account = `${details.manual.accountReferencePrefix}-${order.id}`;
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: label, description: text });
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = extractMpesaCode(value);
    if (!code) {
      setProblem("M-Pesa codes have 10 letters and numbers, like TJK3AB12CD. It's at the start of your M-Pesa SMS.");
      return;
    }
    setSending(true);
    setProblem(null);
    try {
      const updated = (await sendPaymentCode(order.id, code, headers)) as Order;
      setCheck(updated.paymentCheck ?? { code, state: "checking", at: new Date().toISOString() });
      setEditing(false);
      setValue("");
      onSent?.(updated);
    } catch (error) {
      setProblem(errorMessage(error, "We couldn't send your code. Please try again."));
    } finally {
      setSending(false);
    }
  };

  const steps: { label: string; value: string; copyValue?: string }[] = till
    ? [{ label: "Till number", value: number }]
    : [
        { label: "Business number", value: number },
        { label: "Account number", value: account },
      ];
  steps.push({ label: "Amount", value: kes(order.total), copyValue: String(Math.ceil(order.total)) });

  return (
    <section aria-labelledby={`pay-manual-${order.id}`} className="rounded-xl border border-[#52B44B]/30 bg-[#52B44B]/5 p-4 text-left">
      <h3 id={`pay-manual-${order.id}`} className="text-sm font-bold uppercase tracking-wide text-[#3f8f3a]">
        Pay with M-Pesa ({till ? "Buy Goods" : "Pay Bill"})
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Open M-Pesa → <strong className="text-foreground">Lipa na M-Pesa</strong> →{" "}
        <strong className="text-foreground">{till ? "Buy Goods and Services" : "Pay Bill"}</strong>, then enter:
      </p>
      <dl className="mt-3 space-y-2">
        {steps.map((step) => (
          <div key={step.label} className="flex items-center justify-between gap-3 rounded-lg bg-card px-3 py-2">
            <dt className="text-sm text-muted-foreground">{step.label}</dt>
            <dd className="flex items-center gap-2">
              <span className="text-base font-bold tabular-nums">{step.value}</span>
              <button
                type="button"
                onClick={() => copy(step.label, step.copyValue ?? step.value)}
                aria-label={`Copy ${step.label.toLowerCase()}`}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
            </dd>
          </div>
        ))}
      </dl>
      {details.instructions && <p className="mt-3 text-xs leading-5 text-muted-foreground">{details.instructions}</p>}

      {check?.state === "checking" && !editing ? (
        <div role="status" className="mt-4 rounded-lg border border-[#52B44B]/40 bg-card p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-[#3f8f3a]">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Code {check.code} received
          </p>
          <p className="mt-1 text-muted-foreground">We're confirming your payment and will let you know as soon as it's done.</p>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline">
            Sent the wrong code? Send it again
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2">
          {check?.state === "not-found" && (
            <p role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                We couldn't find a payment with code <strong>{check.code}</strong>. Check the code in your M-Pesa SMS and send it again, or WhatsApp us.
              </span>
            </p>
          )}
          <Label htmlFor={`mpesa-code-${order.id}`} className="text-sm font-semibold">
            Paid? Enter the M-Pesa code from your SMS
          </Label>
          <div className="flex gap-2">
            <Input
              id={`mpesa-code-${order.id}`}
              value={value}
              onChange={(event) => {
                const text = event.target.value;
                // A pasted SMS becomes just its code.
                setValue(text.length > 12 ? extractMpesaCode(text) ?? text : text.toUpperCase());
                setProblem(null);
              }}
              placeholder="e.g. TJK3AB12CD"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="bg-card font-mono uppercase tracking-wider placeholder:font-sans placeholder:normal-case placeholder:tracking-normal"
            />
            <Button type="submit" disabled={sending || !value.trim()} className="shrink-0 rounded-full bg-[#52B44B] text-white hover:bg-[#52B44B]/90">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send code"}
            </Button>
          </div>
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">You can also paste the whole M-Pesa message. We'll confirm your payment and let you know.</p>
          )}
        </form>
      )}
    </section>
  );
}
