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
import { DEFAULT_LOGO_IMAGE_URL } from "@/lib/site-images";

const RESET_EMAIL_KEY = "creme_admin_reset_email";

function readRecoveryAccessToken() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  if (params.get("type") !== "recovery") return null;

  return params.get("access_token");
}

export default function Login() {
  const { admin, token, login, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetFormOpen, setIsResetFormOpen] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && admin && token) {
      setLocation("/admin");
    }
  }, [admin, token, isLoading, setLocation]);

  useEffect(() => {
    const accessToken = readRecoveryAccessToken();
    if (!accessToken) return;

    setRecoveryAccessToken(accessToken);
    const savedEmail = window.sessionStorage.getItem(RESET_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
    }

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

  const sendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast({
        title: "Email required",
        description: "Enter the admin email address first.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReset(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send reset link");
      }

      window.sessionStorage.setItem(RESET_EMAIL_KEY, email.trim());
      setIsResetFormOpen(false);
      toast({
        title: "Reset link sent",
        description: "Check your inbox to continue.",
      });
    } catch (error) {
      toast({
        title: "Could not send reset link",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
    }
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

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update password");
      }

      const storedEmail = window.sessionStorage.getItem(RESET_EMAIL_KEY) || email.trim();
      if (!storedEmail) {
        throw new Error("We could not restore the email address for this reset.");
      }

      await login(storedEmail, newPassword);
      window.sessionStorage.removeItem(RESET_EMAIL_KEY);
      setRecoveryAccessToken(null);
      setLocation("/admin");
      toast({
        title: "Password updated",
        description: "You are signed in again.",
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
            <img src={DEFAULT_LOGO_IMAGE_URL} alt="Channah Cakes" className="h-20 w-20 object-contain rounded-2xl shadow-md" />
            <span className="font-serif text-3xl font-bold text-secondary tracking-tight">
              Channah <span className="text-primary">Cakes</span>
            </span>
          </Link>
          <p className="text-muted-foreground mt-3 text-sm">Staff & admin access only</p>
        </div>

        <Card className="border-none shadow-xl rounded-3xl bg-white">
          <CardHeader className="pb-2 pt-8 px-8">
            <h1 className="font-serif text-2xl font-bold text-foreground">
              {recoveryAccessToken ? "Set a new password" : "Welcome back"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {recoveryAccessToken ? "Choose a fresh password for your admin account." : "Sign in to manage your shop"}
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
                  ) : (
                    "Update password"
                  )}
                </Button>
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
                    onClick={() => setIsResetFormOpen((value) => !value)}
                  >
                    Forgot password?
                  </button>
                </div>

                {isResetFormOpen && (
                  <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      Send a password reset link to your admin email.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={sendResetEmail}
                      disabled={isSendingReset}
                    >
                      {isSendingReset ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send reset link"
                      )}
                    </Button>
                  </div>
                )}

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
