import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";

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
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    setCurrentSrc(src);
    setIsLoaded(false);
  }, [src]);

  useEffect(() => {
    isLoadedRef.current = isLoaded;
  }, [isLoaded]);

  useEffect(() => {
    if (!timeoutMs) return;

    const timer = window.setTimeout(() => {
      if (!isLoadedRef.current) {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        } else {
          setIsLoaded(true);
        }
      }
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [currentSrc, fallbackSrc, timeoutMs]);

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
          if (fallbackSrc && currentSrc !== fallbackSrc) {
            setCurrentSrc(fallbackSrc);
            return;
          }
          setIsLoaded(true);
          onError?.(event);
        }}
      />
    </div>
  );
}
