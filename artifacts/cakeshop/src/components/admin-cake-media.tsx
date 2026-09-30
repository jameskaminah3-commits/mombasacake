import { useEffect, useRef, useState } from "react";
import type { CakeMediaItem } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, Film, ImagePlus, Loader2, Play, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { captureVideoPoster, normalizeSupabaseMediaUrl, uploadCakeVideo, uploadSupabaseMedia } from "@/lib/supabase-media";

export const MAX_CAKE_MEDIA = 12;
export const MAX_CAKE_VIDEOS = 4;

type Upload = { id: number; label: string; progress: number | null };

// A cake's extra photos and videos (after its main image): add several at once, put them in order, remove.
export function AdminCakeMedia({
  value,
  onChange,
  onBusyChange,
}: {
  value: CakeMediaItem[];
  onChange: (items: CakeMediaItem[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { token } = useAuth();
  const { toast } = useToast();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  // Uploads finish one by one while the owner keeps editing, so always add to the latest list.
  const latest = useRef(value);
  latest.current = value;
  const nextId = useRef(0);

  useEffect(() => onBusyChange?.(uploads.length > 0), [uploads.length, onBusyChange]);

  const videoCount = value.filter((item) => item.type === "video").length;
  const room = MAX_CAKE_MEDIA - value.length - uploads.length;

  const track = (label: string) => {
    const upload = { id: nextId.current++, label, progress: null };
    setUploads((current) => [...current, upload]);
    return {
      progress: (fraction: number) => setUploads((current) => current.map((item) => (item.id === upload.id ? { ...item, progress: fraction } : item))),
      done: () => setUploads((current) => current.filter((item) => item.id !== upload.id)),
    };
  };
  const add = (item: CakeMediaItem) => {
    latest.current = [...latest.current, item];
    onChange(latest.current);
  };

  const addPhotos = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > room) {
      toast({ title: `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"}`, description: `A cake can have up to ${MAX_CAKE_MEDIA} extra photos and videos.` });
    }
    for (const file of files.slice(0, Math.max(room, 0))) {
      const upload = track(file.name);
      try {
        const { url } = await uploadSupabaseMedia(file, token || "", "cakes");
        add({ type: "image", url });
      } catch (error) {
        toast({ title: `Couldn't upload ${file.name}`, description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
      } finally {
        upload.done();
      }
    }
  };

  const addVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const upload = track(file.name);
    try {
      const [{ url }, poster] = await Promise.all([uploadCakeVideo(file, token || "", upload.progress), captureVideoPoster(file)]);
      const posterUrl = poster ? await uploadSupabaseMedia(poster, token || "", "cake-videos").then((result) => result.url, () => null) : null;
      add({ type: "video", url, posterUrl });
    } catch (error) {
      toast({ title: "Couldn't upload the video", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      upload.done();
    }
  };

  const move = (index: number, step: -1 | 1) => {
    const items = [...value];
    [items[index], items[index + step]] = [items[index + step], items[index]];
    onChange(items);
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">More photos and videos</p>
        <p className="text-xs leading-5 text-muted-foreground">
          Shown after the main image on the cake page, in this order. Up to {MAX_CAKE_MEDIA} ({MAX_CAKE_VIDEOS} videos). Big phone photos are resized
          automatically. Videos up to 50 MB: short clips of 15–60 seconds work best.
        </p>
      </div>

      {(value.length > 0 || uploads.length > 0) && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Extra photos and videos">
          {value.map((item, index) => {
            const label = `${item.type === "video" ? "video" : "photo"} ${index + 1}`;
            const preview = item.type === "image" ? item.url : item.posterUrl;
            return (
              <li key={`${item.url}-${index}`} className="relative aspect-square overflow-hidden rounded-md border bg-background">
                {preview ? (
                  <img src={normalizeSupabaseMediaUrl(preview) || preview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-foreground/85 text-background">
                    <Film className="h-6 w-6" />
                  </div>
                )}
                {item.type === "video" && (
                  <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <Play className="h-2.5 w-2.5 fill-current" /> Video
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  aria-label={`Remove ${label}`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${label} earlier`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:invisible"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    aria-label={`Move ${label} later`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:invisible"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
          {uploads.map((upload) => (
            <li key={`upload-${upload.id}`} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-background p-2 text-center" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs font-medium">{upload.progress == null ? "Uploading…" : `${Math.round(upload.progress * 100)}%`}</span>
              <span className="w-full truncate text-[10px] text-muted-foreground">{upload.label}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => photoInput.current?.click()} disabled={room <= 0}>
          <ImagePlus className="h-4 w-4" /> Add photos
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => videoInput.current?.click()} disabled={room <= 0 || videoCount >= MAX_CAKE_VIDEOS}>
          <Video className="h-4 w-4" /> Add a video
        </Button>
      </div>
      <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple className="hidden" onChange={addPhotos} />
      <input ref={videoInput} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" className="hidden" onChange={addVideo} />
    </div>
  );
}
