import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { RevealImage } from "@/components/reveal-image";
import { DEFAULT_GALLERY_IMAGE_URL } from "@/lib/site-images";
import { cn } from "@/lib/utils";

export type CoverSlide = { imageUrl: string; title: string };

export const MAX_COVER_PHOTOS = 6;
const SLIDE_MS = 5000;
// Later photos load one at a time, a moment after the page, so the first screen stays fast.
const FIRST_PRELOAD_MS = 2500;

// Stay on the first photo for people who ask their phone for less motion or less data.
function prefersStill() {
  if (typeof window === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

// The shop's cover: one photo, or a slow fade from one to the next every few seconds (Admin → Homepage).
export function CoverSlideshow({ slides, className }: { slides: CoverSlide[]; className?: string }) {
  const count = Math.min(slides.length, MAX_COVER_PHOTOS);
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(1);
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set());
  const [failed, setFailed] = useState<ReadonlySet<number>>(() => new Set());
  const [paused, setPaused] = useState(prefersStill);
  const [onScreen, setOnScreen] = useState(true);
  const shownAt = useRef(Date.now());
  const ref = useRef<HTMLDivElement>(null);

  const nextIndex = (from: number) => {
    for (let step = 1; step < count; step++) {
      const index = (from + step) % count;
      if (!failed.has(index)) return index;
    }
    return from;
  };

  // Only move while the cover can be seen.
  useEffect(() => {
    const element = ref.current;
    if (!element || count < 2) return;
    let inView = true;
    const update = () => setOnScreen(inView && document.visibilityState !== "hidden");
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [count]);

  // Put the second photo in the page a moment after the first screen has loaded.
  useEffect(() => {
    if (count < 2 || paused) return;
    const timer = window.setTimeout(() => setMounted((current) => Math.max(current, 2)), FIRST_PRELOAD_MS);
    return () => window.clearTimeout(timer);
  }, [count, paused]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [active]);

  // Fade to the next photo once it has loaded and the current one has had its turn; then load the one after.
  // (nextIndex only reads `count` and `failed`, which are listed.)
  useEffect(() => {
    if (count < 2 || paused || !onScreen) return;
    const next = nextIndex(active);
    if (next === active) return;
    if (!loaded.has(next)) {
      // Once loading has started, make sure the next photo is in the page (it can be past one that failed).
      if (mounted > 1 && next >= mounted) setMounted(next + 1);
      return;
    }
    const wait = Math.max(600, SLIDE_MS - (Date.now() - shownAt.current));
    const timer = window.setTimeout(() => {
      setActive(next);
      setMounted((current) => Math.max(current, Math.min(count, next + 2)));
    }, wait);
    return () => window.clearTimeout(timer);
  }, [active, count, paused, onScreen, loaded, failed, mounted]);

  if (count === 0) return <div className={cn("bg-muted", className)} />;

  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-muted", className)}>
      {slides.slice(0, Math.min(mounted, count)).map((slide, index) => (
        <div
          key={`${index}-${slide.imageUrl}`}
          aria-hidden={index !== active}
          className={cn("absolute inset-0 transition-opacity duration-1000 ease-in-out", index === active ? "opacity-100" : "opacity-0")}
        >
          <RevealImage
            src={slide.imageUrl}
            alt={index === active ? slide.title : ""}
            className="object-cover"
            eager={index === 0}
            fallbackSrc={index === 0 ? DEFAULT_GALLERY_IMAGE_URL : undefined}
            placeholderClassName="bg-muted"
            onLoad={() => setLoaded((current) => new Set(current).add(index))}
            onError={() => setFailed((current) => new Set(current).add(index))}
          />
          {slide.title && (
            <span
              aria-hidden="true"
              className="absolute left-2 top-2 max-w-[60%] truncate rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm"
            >
              {slide.title}
            </span>
          )}
        </div>
      ))}

      {count > 1 && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/35 py-0.5 pl-2 pr-0.5 backdrop-blur-sm">
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: count }, (_, index) => (
              <span key={index} className={cn("h-1.5 w-1.5 rounded-full transition-colors", index === active ? "bg-white" : "bg-white/45")} />
            ))}
          </span>
          <button
            type="button"
            onClick={() => setPaused((current) => !current)}
            aria-label={paused ? "Play the cover photos" : "Pause the cover photos"}
            className="flex h-6 w-6 items-center justify-center rounded-full text-white hover:bg-white/20"
          >
            {paused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3 fill-current" />}
          </button>
        </div>
      )}
    </div>
  );
}
