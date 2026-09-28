import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <p className="text-5xl font-extrabold tracking-tight text-primary">404</p>
      <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Button asChild className="mt-8 rounded-full px-6">
        <Link href="~/">Back to shop</Link>
      </Button>
    </div>
  );
}
