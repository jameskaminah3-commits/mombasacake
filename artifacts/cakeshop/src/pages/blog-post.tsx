import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-base";
import { RevealImage } from "@/components/reveal-image";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`${getApiBaseUrl()}/api/blog/${slug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setIsLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setPost(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6">
        <Skeleton className="h-8 w-32 mb-8" />
        <Skeleton className="h-12 w-full mb-4" />
        <Skeleton className="h-64 w-full rounded-2xl mb-8" />
        <Skeleton className="h-4 w-full mb-3" />
        <Skeleton className="h-4 w-full mb-3" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight mb-4">Post not found</h1>
        <Button asChild className="rounded-full px-6"><Link href="/blog">Back to blog</Link></Button>
      </div>
    );
  }

  return (
    <div className="bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6">
        <Link href="/blog" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to blog
        </Link>

        {post.coverImageUrl && (
          <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-6 bg-muted">
            <RevealImage
              src={post.coverImageUrl}
              alt={post.title}
              className="object-cover"
              timeoutMs={2500}
            />
          </div>
        )}

        {post.publishedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
            <Calendar className="w-3 h-3" />
            <span>{formatDate(post.publishedAt)}</span>
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6 text-foreground leading-tight">
          {post.title}
        </h1>

        <div
          className="prose prose-headings:font-bold prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-primary max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, "<br/>") }}
        />
      </div>
    </div>
  );
}
