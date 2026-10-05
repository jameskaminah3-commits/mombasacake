import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

const VIDEO_ID = /^[\w-]{11}$/;

// A YouTube video's ID from a link in any form: watch?v=, youtu.be/, Shorts, embed, live.
export function youTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (VIDEO_ID.test(value)) return value;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return VIDEO_ID.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v) return VIDEO_ID.test(v) ? v : null;
      return url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})(?:[/?]|$)/)?.[1] ?? null;
    }
  } catch {
    // Not a web address.
  }
  return null;
}

export const youTubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const youTubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
// Privacy-enhanced player: no YouTube cookies until the customer plays the video.
export const youTubeEmbedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;

export type ChannelVideo = { id: string; title: string; published: string | null; thumbnail: string; url: string; short: boolean };

export function fetchChannelVideos(channel: string) {
  return customFetch<{ channelId: string; videos: ChannelVideo[] }>(`${getApiBaseUrl()}/api/youtube/videos?channel=${encodeURIComponent(channel)}`);
}
