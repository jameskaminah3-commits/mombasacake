import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Link } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-base";
import { normalizeSupabaseMediaUrl } from "@/lib/supabase-media";
import { DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";

// A password link from an email: "invite" (a new admin setting their first password), or "recovery" (reset links
// sent before Forgot password used codes).
function readPasswordLink() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const type = params.get("type");
  const token = params.get("access_token");
  if ((type !== "recovery" && type !== "invite") || !token) return null;

  return { token, invite: type === "invite" };
}

export default function Login() {
  const { admin, token, login, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Forgot password: ask for a code by email, then enter it with the new password.
  const [mode, setMode] = useState<"signin" | "reset-email" | "reset-code">("signin");
  const [resetCode, setResetCode] = useState("");
  const [resetProblem, setResetProblem] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null);
  const [isInvite, setIsInvite] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && admin && token) {
      setLocation("/admin");
    }
  }, [admin, token, isLoading, setLocation]);

  useEffect(() => {
    const link = readPasswordLink();
    if (!link) return;

    setRecoveryAccessToken(link.token);
    setIsInvite(link.invite);
    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      setLocation("/admin");
    } catch (err: unknown) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Invalid credentials",
        variant: "destructive",
      });
    }
  };

  const sendResetCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email.trim()) {
      setResetProblem("Enter your admin email address.");
      return;
    }

    setIsSendingReset(true);
    setResetProblem(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "We couldn't send the code. Please try again.");
      }
      setResetCode("");
      setMode("reset-code");
      toast({ title: "Code sent", description: `If ${email.trim()} is an admin account, a 6-digit code is on its way.` });
    } catch (error) {
      setResetProblem(error instanceof Error ? error.message : "We couldn't send the code. Please try again.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const resetWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setResetProblem("Use at least 8 characters for the password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetProblem("The two passwords don't match.");
      return;
    }

    setIsUpdatingPassword(true);
    setResetProblem(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/password-reset/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: resetCode, password: newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "We couldn't reset the password. Please try again.");
      }
      await login(data.admin?.email || email.trim(), newPassword);
      setLocation("/admin");
      toast({ title: "Password updated", description: "You're signed in." });
    } catch (error) {
      setResetProblem(error instanceof Error ? error.message : "We couldn't reset the password. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const backToSignIn = () => {
    setMode("signin");
    setResetProblem(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recoveryAccessToken) return;

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Use at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Enter the same password twice.",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/password-update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: recoveryAccessToken, password: newPassword }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      // The link may be opened on another phone or computer than the one that asked for it, so the account's
      // email comes from the reply.
      const accountEmail = data.admin?.email || email.trim();
      if (!accountEmail) {
        throw new Error("Your password is set. Sign in with your email and new password.");
      }

      await login(accountEmail, newPassword);
      setRecoveryAccessToken(null);
      setLocation("/admin");
      toast({
        title: isInvite ? "Welcome!" : "Password updated",
        description: isInvite ? "Your password is set and you're signed in." : "You are signed in again.",
      });
    } catch (error) {
      toast({
        title: "Could not update password",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf7f4] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex flex-col items-center gap-2">
            <img
              src={normalizeSupabaseMediaUrl(DEFAULT_LOGO_IMAGE_URL) || DEFAULT_LOGO_IMAGE_URL}
              alt="Channah Cakes"
              className="h-20 w-20 object-contain rounded-2xl shadow-md"
            />
            <span className="font-serif text-3xl font-bold text-secondary tracking-tight">
              Channah <span className="text-primary">Cakes</span>
            </span>
          </Link>
          <p className="text-muted-foreground mt-3 text-sm">Staff & admin access only</p>
        </div>

        <Card className="border-none shadow-xl rounded-3xl bg-white">
          <CardHeader className="pb-2 pt-8 px-8">
            <h1 className="font-serif text-2xl font-bold text-foreground">
              {recoveryAccessToken
                ? isInvite
                  ? "Set your password"
                  : "Set a new password"
                : mode === "reset-email"
                  ? "Reset your password"
                  : mode === "reset-code"
                    ? "Enter your code"
                    : "Welcome back"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {recoveryAccessToken
                ? isInvite
                  ? "You've been added as an admin. Choose a password to sign in."
                  : "Choose a fresh password for your admin account."
                : mode === "reset-email"
                  ? "We'll email you a 6-digit code to reset it."
                  : mode === "reset-code"
                    ? `We've emailed a 6-digit code to ${email.trim()}. It works for 15 minutes.`
                    : "Sign in to manage your shop"}
            </p>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            {recoveryAccessToken ? (
              <form onSubmit={updatePassword} className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium text-foreground">
                    New password
                  </Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter a new password"
                    required
                    className="h-12 rounded-xl border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                    Confirm password
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat the new password"
                    required
                    className="h-12 rounded-xl border-border"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full h-12 rounded-xl font-semibold text-base bg-primary hover:bg-primary/90 text-white mt-2"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : isInvite ? (
                    "Set password"
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>
            ) : mode === "reset-email" ? (
              <form onSubmit={sendResetCode} className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium text-foreground">
                    Email address
                  </Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@channahcakes.ke"
                    required
                    className="h-12 rounded-xl border-border"
                  />
                </div>
                {resetProblem && (
                  <p role="alert" className="text-sm text-destructive">
                    {resetProblem}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isSendingReset}
                  className="w-full h-12 rounded-xl font-semibold text-base bg-primary hover:bg-primary/90 text-white"
                >
                  {isSendingReset ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send code"
                  )}
                </Button>
                <button type="button" onClick={backToSignIn} className="w-full text-sm font-medium text-muted-foreground hover:text-primary">
                  Back to sign in
                </button>
              </form>
            ) : mode === "reset-code" ? (
              <form onSubmit={resetWithCode} className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-code" className="text-sm font-medium text-foreground">
                    6-digit code
                  </Label>
                  <Input
                    id="reset-code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Code from the email"
                    required
                    className="h-12 rounded-xl border-border text-center font-mono text-xl tracking-[0.4em] placeholder:font-sans placeholder:text-base placeholder:tracking-normal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-password" className="text-sm font-medium text-foreground">
                    New password
                  </Label>
                  <Input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    className="h-12 rounded-xl border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm" className="text-sm font-medium text-foreground">
                    Confirm password
                  </Label>
                  <Input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat the new password"
                    required
                    className="h-12 rounded-xl border-border"
                  />
                </div>
                {resetProblem && (
                  <p role="alert" className="text-sm text-destructive">
                    {resetProblem}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={isUpdatingPassword || resetCode.length !== 6}
                  className="w-full h-12 rounded-xl font-semibold text-base bg-primary hover:bg-primary/90 text-white"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => sendResetCode()} disabled={isSendingReset} className="font-medium text-primary hover:underline disabled:opacity-60">
                    {isSendingReset ? "Sending..." : "Send a new code"}
                  </button>
                  <button type="button" onClick={backToSignIn} className="font-medium text-muted-foreground hover:text-primary">
                    Back to sign in
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@channahcakes.ke"
                    required
                    className="h-12 rounded-xl border-border"
                    data-testid="input-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className="h-12 rounded-xl border-border pr-12"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-sm font-medium text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setResetProblem(null);
                      setMode("reset-email");
                    }}
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl font-semibold text-base bg-primary hover:bg-primary/90 text-white mt-2"
                  data-testid="button-login"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            )}

            <div className="mt-6 pt-6 border-t border-border text-center">
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Back to storefront
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Channah Cakes &mdash; Mombasa, Kenya
        </p>
      </div>
    </div>
  );
}
