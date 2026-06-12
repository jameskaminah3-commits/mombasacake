import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { normalizeSupabaseMediaUrl } from "@/lib/supabase-media";

type RevealImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src: string;
  alt: string;
  eager?: boolean;
  fallbackSrc?: string;
  placeholderClassName?: string;
  timeoutMs?: number;
};

export function RevealImage({
  src,
  alt,
  eager = false,
  fallbackSrc,
  placeholderClassName = "bg-white/10",
  timeoutMs = 4500,
  className,
  onLoad,
  onError,
  ...props
}: RevealImageProps) {
  const normalizedSrc = normalizeSupabaseMediaUrl(src) || src;
  const normalizedFallbackSrc = fallbackSrc ? normalizeSupabaseMediaUrl(fallbackSrc) || fallbackSrc : undefined;
  const [currentSrc, setCurrentSrc] = useState(normalizedSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    setCurrentSrc(normalizedSrc);
    setIsLoaded(false);
  }, [normalizedSrc]);

  useEffect(() => {
    isLoadedRef.current = isLoaded;
  }, [isLoaded]);

  useEffect(() => {
    if (!timeoutMs) return;

    const timer = window.setTimeout(() => {
      if (!isLoadedRef.current) {
        if (normalizedFallbackSrc && currentSrc !== normalizedFallbackSrc) {
          setCurrentSrc(normalizedFallbackSrc);
        } else {
          setIsLoaded(true);
        }
      }
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [currentSrc, normalizedFallbackSrc, timeoutMs]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className={`absolute inset-0 animate-pulse transition-opacity duration-500 ${placeholderClassName} ${
          isLoaded ? "opacity-0" : "opacity-100"
        }`}
      />
      <img
        {...props}
        src={currentSrc}
        alt={alt}
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${className ?? ""} ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        loading={eager ? "eager" : props.loading ?? "lazy"}
        decoding={props.decoding ?? "async"}
        fetchPriority={eager ? "high" : props.fetchPriority}
        onLoad={(event) => {
          setIsLoaded(true);
          onLoad?.(event);
        }}
        onError={(event) => {
          if (normalizedFallbackSrc && currentSrc !== normalizedFallbackSrc) {
            setCurrentSrc(normalizedFallbackSrc);
            return;
          }
          setIsLoaded(true);
          onError?.(event);
        }}
      />
    </div>
  );
}
