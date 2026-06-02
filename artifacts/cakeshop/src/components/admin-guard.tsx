import { useAuth } from "@/lib/auth-context";
import { useLocation } from "wouter";
import { useEffect } from "react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { admin, token } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!admin || !token) {
      setLocation("/login");
    }
  }, [admin, token, setLocation]);

  if (!admin || !token) {
    return null;
  }

  return <>{children}</>;
}
