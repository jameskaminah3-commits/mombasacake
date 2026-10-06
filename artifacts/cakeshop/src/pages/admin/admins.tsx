import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Copy, Loader2, MailCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getApiBaseUrl } from "@/lib/api-base";
import { errorMessage } from "@/lib/customer";

type AdminRow = { id: number; name: string; email: string; createdAt: string; you: boolean };
type AddResult = { admin: AdminRow; emailed: boolean; inviteLink: string | null; inviteDays: number };

const api = (path: string) => `${getApiBaseUrl()}/api${path}`;

// Who can sign in to Admin. Every admin also gets the shop's alerts: new orders and M-Pesa codes to check.
export default function AdminAdmins() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: admins, isLoading, isError, refetch } = useQuery({ queryKey: ["admins"], queryFn: () => customFetch<AdminRow[]>(api("/admins")) });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [manualInvite, setManualInvite] = useState<{ email: string; link: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    setAdding(true);
    setProblem(null);
    setManualInvite(null);
    try {
      const result = await customFetch<AddResult>(api("/admins"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      await queryClient.invalidateQueries({ queryKey: ["admins"] });
      setName("");
      setEmail("");
      if (result.emailed) {
        toast({ title: `Invite sent to ${result.admin.email}`, description: `They set their password from the email. The link works for ${result.inviteDays} days.` });
      } else if (result.inviteLink) {
        setManualInvite({ email: result.admin.email, link: result.inviteLink });
      }
    } catch (error) {
      setProblem(errorMessage(error, "Couldn't add that admin. Please try again."));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (admin: AdminRow) => {
    if (!window.confirm(`Remove ${admin.name} (${admin.email})? They won't be able to sign in or get order alerts any more.`)) return;
    try {
      await customFetch(api(`/admins/${admin.id}`), { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["admins"] });
      toast({ title: `${admin.name} removed` });
    } catch (error) {
      toast({ title: "Couldn't remove them", description: errorMessage(error, "Please try again."), variant: "destructive" });
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { recipients } = await customFetch<{ recipients: string[] }>(api("/admins/test-alert"), { method: "POST" });
      toast({ title: "Test email sent", description: `To ${recipients.join(", ")}. Check those inboxes (and spam).` });
    } catch (error) {
      toast({ title: "The test email didn't go out", description: errorMessage(error, "Please try again."), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const copyInvite = async () => {
    if (!manualInvite) return;
    try {
      await navigator.clipboard.writeText(manualInvite.link);
      toast({ title: "Invite link copied", description: `Send it to ${manualInvite.email}, e.g. on WhatsApp.` });
    } catch {
      window.prompt("Copy the invite link:", manualInvite.link);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admins</h1>
        <p className="mt-1 text-muted-foreground">
          Everyone here can sign in to Admin, and gets the shop's order alerts by email: new orders and M-Pesa codes to check.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">Who gets order alerts</h2>
          <Button type="button" variant="outline" className="rounded-full" onClick={sendTest} disabled={testing || !admins?.length}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
            Send a test alert
          </Button>
        </div>
        {isLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <p className="mt-4 text-sm">
            Couldn't load the admins.{" "}
            <button type="button" onClick={() => refetch()} className="font-medium text-primary underline">
              Try again
            </button>
          </p>
        ) : (
          <ul className="mt-4 divide-y rounded-xl border" aria-label="Admins">
            {admins?.map((admin) => (
              <li key={admin.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{admin.name}</span>
                    {admin.you && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">You</span>}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
                </div>
                <p className="hidden text-xs text-muted-foreground sm:block">Added {format(new Date(admin.createdAt), "d MMM yyyy")}</p>
                {!admin.you && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(admin)} aria-label={`Remove ${admin.name}`} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight">Add an admin</h2>
        <p className="mt-1 text-sm text-muted-foreground">They get an email with a link to set their password, then they can sign in and get order alerts.</p>
        <form onSubmit={add} className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="admin-name">Name</Label>
            <Input id="admin-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" placeholder="e.g. Mary Achieng" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" placeholder="mary@example.com" />
          </div>
          <Button type="submit" disabled={adding || !name.trim() || !email.trim()} className="h-10 rounded-full">
            {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Add admin
          </Button>
        </form>
        {problem && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {problem}
          </p>
        )}
        {manualInvite && (
          <div role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">{manualInvite.email} is added, but the invite email couldn't be sent.</p>
            <p className="mt-1">Send them this link yourself (it lets them set their password, so only send it to them):</p>
            <div className="mt-2 flex gap-2">
              <Input readOnly value={manualInvite.link} aria-label="Invite link" className="bg-white font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copyInvite}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
