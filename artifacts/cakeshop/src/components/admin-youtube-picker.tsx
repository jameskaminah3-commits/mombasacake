import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/customer";
import { STORE_SOCIALS } from "@/lib/store-info";
import { fetchChannelVideos, youTubeVideoId } from "@/lib/youtube";

const SHOP_CHANNEL = STORE_SOCIALS.find((social) => social.label === "YouTube")?.href ?? "";

// Adding a YouTube video to a cake: pick one of the shop channel's latest videos, or paste any YouTube link.
export function AdminYouTubePicker({
  added,
  onAdd,
  onClose,
  full,
}: {
  added: string[];
  onAdd: (videoId: string) => void;
  onClose: () => void;
  full: boolean;
}) {
  const [channel, setChannel] = useState(SHOP_CHANNEL);
  const [channelInput, setChannelInput] = useState(SHOP_CHANNEL);
  const [link, setLink] = useState("");
  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  const { data, error, isLoading } = useQuery({
    queryKey: ["youtube-videos", channel],
    queryFn: () => fetchChannelVideos(channel),
    enabled: !!channel,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  // This sits inside the cake's form, so Enter in its boxes must not save the cake.
  const onEnter = (action: () => void) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    action();
  };

  const addLink = () => {
    if (full || !link.trim()) return;
    const id = youTubeVideoId(link);
    if (!id) {
      setLinkProblem("That isn't a YouTube video link. Copy it from the video's Share button.");
      return;
    }
    if (added.includes(id)) {
      setLinkProblem("That video is already on this cake.");
      return;
    }
    onAdd(id);
    setLink("");
    setLinkProblem(null);
  };

  const loadChannel = () => {
    if (channelInput.trim()) setChannel(channelInput.trim());
  };

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Add a video from YouTube</p>
        <button type="button" onClick={onClose} aria-label="Close YouTube videos" className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="youtube-link" className="text-xs">
          Paste a YouTube link
        </Label>
        <div className="flex gap-2">
          <Input
            id="youtube-link"
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              setLinkProblem(null);
            }}
            onKeyDown={onEnter(addLink)}
            placeholder="https://youtube.com/shorts/…"
            inputMode="url"
            autoComplete="off"
          />
          <Button type="button" variant="outline" onClick={addLink} disabled={full || !link.trim()}>
            Add
          </Button>
        </div>
        {linkProblem && (
          <p role="alert" className="text-xs text-destructive">
            {linkProblem}
          </p>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest on the shop's YouTube channel</p>
        {isLoading ? (
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {errorMessage(error, "Couldn't load the channel's videos.")} You can still paste a video link above.
          </p>
        ) : !data?.videos.length ? (
          <p className="mt-2 text-xs text-muted-foreground">No videos on this channel yet.</p>
        ) : (
          <ul className="mt-2 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3" aria-label="YouTube videos">
            {data.videos.map((video) => {
              const isAdded = added.includes(video.id);
              return (
                <li key={video.id}>
                  <button
                    type="button"
                    onClick={() => onAdd(video.id)}
                    disabled={isAdded || full}
                    aria-label={isAdded ? `${video.title} (added)` : `Add ${video.title}`}
                    className="group block w-full text-left disabled:cursor-default"
                  >
                    <span className="relative block aspect-video overflow-hidden rounded-md bg-muted">
                      <img src={video.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {video.short && <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">Short</span>}
                      {isAdded && (
                        <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/55 text-xs font-semibold text-white">
                          <Check className="h-4 w-4" /> Added
                        </span>
                      )}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-4 group-enabled:group-hover:text-primary">{video.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Use a different channel</summary>
        <div className="mt-2 flex gap-2">
          <Input
            value={channelInput}
            onChange={(event) => setChannelInput(event.target.value)}
            onKeyDown={onEnter(loadChannel)}
            placeholder="https://www.youtube.com/@yourchannel"
            aria-label="YouTube channel link"
          />
          <Button type="button" variant="outline" onClick={loadChannel}>
            Load
          </Button>
        </div>
      </details>
    </div>
  );
}
