import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Calendar } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-base";
import { RevealImage } from "@/components/reveal-image";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/api/blog`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(Array.isArray(data) ? data : []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="bg-background">
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">From our kitchen</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">The Crème Journal</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Baking tips, occasion inspiration, and stories from our Mombasa patisserie.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-52 w-full rounded-2xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-24">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2 text-foreground">Coming soon</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We are working on some delicious stories to share. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="group h-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
                  <div className="aspect-[16/9] overflow-hidden bg-muted">
                    {post.coverImageUrl ? (
                      <RevealImage
                        src={post.coverImageUrl}
                        alt={post.title}
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        timeoutMs={2500}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/10">
                        <BookOpen className="w-12 h-12 text-secondary/40" />
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {post.publishedAt && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(post.publishedAt)}</span>
                      </div>
                    )}
                    <h2 className="text-base font-bold mb-2 group-hover:text-primary transition-colors leading-snug">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                    <p className="mt-4 text-primary text-sm font-semibold">Read more &rarr;</p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
