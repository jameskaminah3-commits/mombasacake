import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  errorMessage,
  orderPath,
  saveAccountDetails,
  setCustomerSession,
  startEmailSignIn,
  useAccountOverview,
  useCustomerSession,
  useEmailLoginAvailable,
  verifyEmailSignIn,
} from "@/lib/customer";
import { orderStatusLabel } from "@/pages/my-orders";
import { displayKenyanPhone } from "@/lib/phone";
import { ReferralCard } from "@/pages/order";

// Optional customer account: sign in with a code sent by email to see every order, keep details and get a referral code.
export default function Account() {
  const session = useCustomerSession();
  return session ? <AccountHome /> : <SignIn />;
}

function SignIn() {
  const loginAvailable = useEmailLoginAvailable();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      await startEmailSignIn(email.trim());
      setStep("code");
    } catch (error) {
      setProblem(errorMessage(error, "We couldn't send the code. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const result = await verifyEmailSignIn(email.trim(), code.trim());
      setCustomerSession({ token: result.token, email: result.account.email });
    } catch (error) {
      setProblem(errorMessage(error, "That code didn't work. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm px-4 pb-12 pt-10">
      <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Optional, but handy: see all your orders on any phone, keep your delivery details, and get your referral code to earn rewards.
      </p>
      {!loginAvailable ? (
        <p className="mt-6 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
          Signing in isn't available just yet. Your orders on this phone are under{" "}
          <Link href="/orders" className="font-semibold text-primary underline-offset-2 hover:underline">
            My orders
          </Link>
          .
        </p>
      ) : step === "email" ? (
        <form onSubmit={sendCode} className="mt-6 space-y-3">
          <Label htmlFor="signin-email">Email address</Label>
          <Input id="signin-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          <Button type="submit" className="w-full rounded-full" disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />} Email me a code
          </Button>
          <p className="text-xs text-muted-foreground">No password needed. We'll email you a 6-digit code.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-3">
          <Label htmlFor="signin-code">Code sent to {email}</Label>
          <Input
            id="signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="text-center text-lg tracking-[0.4em]"
          />
          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}
          <Button type="submit" className="w-full rounded-full" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Sign in
          </Button>
          <button type="button" className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline" onClick={() => setStep("email")}>
            Use a different email, or send a new code
          </button>
        </form>
      )}
    </div>
  );
}

function AccountHome() {
  const session = useCustomerSession()!;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useAccountOverview();
  const [details, setDetails] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDetails({ name: data.account.name, phone: data.account.phone ? displayKenyanPhone(data.account.phone) : "", address: data.account.address });
  }, [data]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await saveAccountDetails(session, details);
      await queryClient.invalidateQueries({ queryKey: ["customer-account"] });
      toast({ title: "Details saved", description: "They'll be filled in at checkout." });
    } catch (error) {
      toast({ title: "Couldn't save your details", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-12 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My account</h1>
          <p className="mt-1 text-sm text-muted-foreground">{session.email}</p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setCustomerSession(null)}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <>
          {data.referral ? (
            <ReferralCard referral={data.referral} phone={data.referral.phone} />
          ) : (
            <p className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-sm text-muted-foreground">
              Place your first order to get your referral code: friends get money off, and you earn rewards.
            </p>
          )}

          <section aria-labelledby="account-orders-title" className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 id="account-orders-title" className="text-base font-bold">
                Your orders
              </h2>
              <Link href="/orders" className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
                See all
              </Link>
            </div>
            {data.orders.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No orders with this email yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {data.orders.slice(0, 5).map((order) => (
                  <li key={order.id}>
                    <Link href={orderPath(order)} className="flex items-center gap-3 py-3 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">Order #{order.id}</span>
                        <span className="text-muted-foreground"> · {orderStatusLabel(order)}</span>
                        <span className="block truncate text-muted-foreground">
                          {order.items.map((item) => item.cakeName).join(", ")} · KES {Math.round(order.total).toLocaleString()}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={save} aria-labelledby="account-details-title" className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <h2 id="account-details-title" className="text-base font-bold">
              Delivery details
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" autoComplete="name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-phone">M-Pesa phone number</Label>
              <Input id="account-phone" type="tel" inputMode="tel" autoComplete="tel" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-address">Delivery address</Label>
              <Textarea id="account-address" autoComplete="street-address" value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} className="resize-none" />
            </div>
            <Button type="submit" className="rounded-full" disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
