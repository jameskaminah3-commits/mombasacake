import { useEffect, useMemo, useRef, useState } from "react";
import type { CakeMediaItem } from "@workspace/api-client-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Film, Play, X, ZoomIn } from "lucide-react";
import { SiYoutube } from "react-icons/si";
import { RevealImage } from "@/components/reveal-image";
import { DEFAULT_CAKE_IMAGE_URL } from "@/lib/site-images";
import { normalizeSupabaseMediaUrl } from "@/lib/supabase-media";
import { cn } from "@/lib/utils";
import { youTubeEmbedUrl, youTubeVideoId } from "@/lib/youtube";

const smooth = () => (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
const src = (url: string) => normalizeSupabaseMediaUrl(url) || url;
const arrowClass =
  "absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md transition-opacity hover:bg-white disabled:opacity-0 pointer-fine:flex";

// The cake page's photos and videos: swipe (or use the arrows and thumbnails) to move between them, and tap a
// photo to see it full size. A video (from YouTube, or a video file) only loads when it's tapped, which spares
// customers' data.
export function CakeGallery({ name, imageUrl, media }: { name: string; imageUrl: string; media: CakeMediaItem[] }) {
  const items = useMemo<CakeMediaItem[]>(() => [{ type: "image", url: imageUrl }, ...media], [imageUrl, media]);
  const photoIndexes = useMemo(() => items.flatMap((item, index) => (item.type === "image" ? [index] : [])), [items]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);

  // Keep the thumbnails in step with swiping.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setActive(Math.round(track.scrollLeft / Math.max(track.clientWidth, 1))));
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // A video stops when it's swiped away.
  useEffect(() => {
    if (playing !== null && playing !== active) setPlaying(null);
  }, [active, playing]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    const target = Math.max(0, Math.min(items.length - 1, index));
    track?.scrollTo({ left: target * track.clientWidth, behavior: smooth() });
    setActive(target);
  };

  // Full-size view: moves between the photos (videos play in place).
  const stepLightbox = (step: 1 | -1) => {
    if (lightbox === null) return;
    const position = photoIndexes.indexOf(lightbox);
    setLightbox(photoIndexes[(position + step + photoIndexes.length) % photoIndexes.length]);
  };
  const closeLightbox = () => {
    if (lightbox !== null) goTo(lightbox);
    setLightbox(null);
  };
  const lightboxPosition = lightbox === null ? -1 : photoIndexes.indexOf(lightbox);
  const videoCount = media.filter((item) => item.type !== "image").length;
  const hasVideo = videoCount > 0;

  // min-w-0: in the cake page's grid, the row of thumbnails scrolls inside the gallery instead of widening the page.
  return (
    <div className="min-w-0">
      <div className="group relative">
        <div
          ref={trackRef}
          aria-roledescription="carousel"
          aria-label={`${hasVideo ? "Photos and videos" : "Photos"} of ${name}`}
          className="flex aspect-square snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-2xl border border-border/60 bg-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${items.length}`}
              className="relative h-full w-full shrink-0 snap-center snap-always"
            >
              {item.type === "image" ? (
                <button
                  type="button"
                  onClick={() => setLightbox(index)}
                  aria-label={`View ${items.length > 1 ? `photo ${index + 1} of ` : ""}${name} full size`}
                  className="relative block h-full w-full cursor-zoom-in"
                >
                  <RevealImage
                    src={item.url}
                    alt={index === 0 ? name : `${name}, photo ${index + 1}`}
                    className="object-cover"
                    fallbackSrc={index === 0 ? DEFAULT_CAKE_IMAGE_URL : undefined}
                    placeholderClassName="bg-muted"
                    eager={index === 0}
                    timeoutMs={index === 0 ? 3000 : 8000}
                  />
                  <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5 shrink-0" />
                    <span>Tap to zoom</span>
                  </span>
                </button>
              ) : item.type === "youtube" && playing === index ? (
                <iframe
                  src={youTubeEmbedUrl(youTubeVideoId(item.url) ?? "")}
                  title={`Video of ${name}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full bg-black"
                />
              ) : playing === index ? (
                <video
                  src={item.url}
                  poster={item.posterUrl ? src(item.posterUrl) : undefined}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full bg-black object-contain"
                >
                  This video can't play in your browser.
                </video>
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(index)}
                  aria-label={videoCount > 1 ? `Play video ${index + 1} of ${name}` : `Play the video of ${name}`}
                  className="relative block h-full w-full bg-neutral-900"
                >
                  {item.posterUrl ? (
                    <img src={src(item.posterUrl)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <Film className="absolute left-1/2 top-[30%] h-10 w-10 -translate-x-1/2 text-white/40" aria-hidden="true" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm">
                      <Play className="ml-1 h-7 w-7 fill-current" />
                    </span>
                  </span>
                  {item.type === "youtube" && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                      <SiYoutube className="h-3.5 w-3.5 text-[#ff0000]" /> YouTube
                    </span>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <>
            <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous" className={cn(arrowClass, "left-3")}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => goTo(active + 1)} disabled={active === items.length - 1} aria-label="Next" className={cn(arrowClass, "right-3")}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => {
          const preview = item.type === "image" ? item.url : item.posterUrl;
          return (
            <button
              key={`thumb-${item.url}-${index}`}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show ${item.type === "image" ? "photo" : "video"} ${index + 1}`}
              aria-current={active === index ? "true" : undefined}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-muted transition-colors",
                active === index ? "border-foreground" : "border-transparent",
              )}
            >
              {preview ? (
                <RevealImage src={preview} alt="" className="object-cover" placeholderClassName="bg-muted" fallbackSrc={index === 0 ? DEFAULT_CAKE_IMAGE_URL : undefined} />
              ) : (
                <span className="flex h-full w-full bg-neutral-900" />
              )}
              {item.type !== "image" && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                  <Play className="h-5 w-5 fill-current" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <DialogPrimitive.Root open={lightbox !== null} onOpenChange={(open) => !open && closeLightbox()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/95 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") stepLightbox(1);
              if (event.key === "ArrowLeft") stepLightbox(-1);
            }}
            onTouchStart={(event) => {
              touchStart.current = event.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              const end = event.changedTouches[0]?.clientX;
              touchStart.current = null;
              if (start != null && end != null && Math.abs(end - start) > 50) stepLightbox(end < start ? 1 : -1);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <DialogPrimitive.Title className="sr-only">
              {name}
              {photoIndexes.length > 1 ? `, photo ${lightboxPosition + 1} of ${photoIndexes.length}` : ""}, full size
            </DialogPrimitive.Title>
            {lightbox !== null && (
              <img
                src={src(items[lightbox].url)}
                alt={lightbox === 0 ? name : `${name}, photo ${lightbox + 1}`}
                className="rounded-2xl object-contain"
                style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 80px)" }}
              />
            )}
            {photoIndexes.length > 1 && (
              <>
                <button type="button" onClick={() => stepLightbox(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25">
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button type="button" onClick={() => stepLightbox(1)} aria-label="Next photo" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25">
                  <ChevronRight className="h-6 w-6" />
                </button>
                <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
                  {lightboxPosition + 1} / {photoIndexes.length}
                </p>
              </>
            )}
            <DialogPrimitive.Close className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/25">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
