import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin, token, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && (!admin || !token)) {
      setLocation("~/login");
    }
  }, [admin, token, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Checking admin session...
      </div>
    );
  }

  if (!admin || !token) {
    return null;
  }

  return <>{children}</>;
}
