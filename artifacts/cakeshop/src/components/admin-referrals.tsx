import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import { errorMessage, type ReferralProgramme } from "@/lib/customer";

type ReferralRow = {
  id: number;
  code: string;
  status: "pending" | "rewarded" | "cancelled";
  friendName: string | null;
  orderId: number;
  orderPaid: boolean;
  referrerName: string | null;
  referrerCreditBalance: number | null;
  friendDiscount: number;
  referrerReward: number;
  createdAt: string;
  rewardedAt: string | null;
};

const api = (path: string) => `${getApiBaseUrl()}/api${path}`;
const kes = (value: number) => `KES ${Math.round(value).toLocaleString()}`;

const STATUS_LABELS: Record<ReferralRow["status"], string> = {
  pending: "Waiting for payment",
  rewarded: "Reward earned",
  cancelled: "Cancelled",
};

// "Give KES 200, get KES 200": the amounts, an off switch, and who has referred whom.
export function AdminReferrals() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings } = useQuery({
    queryKey: ["admin", "referral-settings"],
    queryFn: () => customFetch<ReferralProgramme>(api("/referrals/settings")),
    staleTime: 0,
  });
  const { data: referrals, isLoading } = useQuery({
    queryKey: ["admin", "referrals"],
    queryFn: () => customFetch<ReferralRow[]>(api("/referrals")),
  });
  const [draft, setDraft] = useState<{ enabled: boolean; friendDiscount: string; referrerReward: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setDraft({ enabled: settings.enabled, friendDiscount: String(settings.friendDiscount), referrerReward: String(settings.referrerReward) });
  }, [settings]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const friendDiscount = Number(draft.friendDiscount);
    const referrerReward = Number(draft.referrerReward);
    if (!Number.isFinite(friendDiscount) || !Number.isFinite(referrerReward) || friendDiscount < 0 || referrerReward < 0) {
      toast({ title: "Enter the amounts in shillings", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const saved = await customFetch<ReferralProgramme>(api("/referrals/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: draft.enabled, friendDiscount: Math.round(friendDiscount), referrerReward: Math.round(referrerReward) }),
      });
      queryClient.setQueryData(["admin", "referral-settings"], saved);
      toast({ title: "Referral rewards saved" });
    } catch (error) {
      toast({ title: "Could not save the referral rewards", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const rewarded = referrals?.filter((referral) => referral.status === "rewarded").length ?? 0;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <h2 className="text-lg font-semibold">Referral rewards</h2>
          <p className="text-sm text-muted-foreground">
            Every customer gets their own code after ordering (like AMINA4894) with a WhatsApp share button. A friend who uses it gets money off their first
            order. When the friend's order is paid, the customer who shared the code earns credit that comes off their next order automatically.
          </p>
        </CardHeader>
        <CardContent>
          {!draft ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <form onSubmit={save} className="space-y-4">
              <label className="flex items-center justify-between gap-3 rounded-md border p-3">
                <span>
                  <span className="block text-sm font-medium">Referral rewards on</span>
                  <span className="block text-xs text-muted-foreground">When off, codes stop working and customers don't see the share card.</span>
                </span>
                <Switch checked={draft.enabled} onCheckedChange={(enabled) => setDraft({ ...draft, enabled })} aria-label="Referral rewards on" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="referral-friend">Friend's discount on their first order (KES)</Label>
                  <Input
                    id="referral-friend"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={50}
                    value={draft.friendDiscount}
                    onChange={(event) => setDraft({ ...draft, friendDiscount: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="referral-reward">Credit for the customer who shared (KES)</Label>
                  <Input
                    id="referral-reward"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={50}
                    value={draft.referrerReward}
                    onChange={(event) => setDraft({ ...draft, referrerReward: event.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save referral rewards"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Referrals</h2>
          <p className="text-sm text-muted-foreground">
            {referrals?.length ?? 0} referred orders, {rewarded} rewarded
          </p>
        </div>
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shared by</TableHead>
                <TableHead>Friend's order</TableHead>
                <TableHead>Rewards</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !referrals?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No referrals yet. They show here when a friend orders with a customer's code.
                  </TableCell>
                </TableRow>
              ) : (
                referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{format(new Date(referral.createdAt), "MMM d, yyyy")}</TableCell>
                    <TableCell>
                      <p className="font-medium">{referral.referrerName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {referral.code}
                        {referral.referrerCreditBalance != null && ` · ${kes(referral.referrerCreditBalance)} credit left`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link href={`~/order/${referral.orderId}`} className="font-medium text-primary hover:underline">
                        {referral.friendName ?? "—"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Order #{referral.orderId} · {referral.orderPaid ? "paid" : "not paid yet"}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <p>Friend: −{kes(referral.friendDiscount)}</p>
                      <p>Sharer: +{kes(referral.referrerReward)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={referral.status === "rewarded" ? "default" : "secondary"}>{STATUS_LABELS[referral.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
