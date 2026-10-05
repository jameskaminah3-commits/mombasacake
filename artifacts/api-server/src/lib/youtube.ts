// YouTube videos for cake galleries: links in any form (watch, youtu.be, Shorts, embed), and a channel's latest
// uploads from YouTube's public feed, which needs no API key. YOUTUBE_ORIGIN is only changed in tests.
const YOUTUBE_ORIGIN = (process.env.YOUTUBE_ORIGIN || "https://www.youtube.com").replace(/\/+$/, "");
const VIDEO_ID = /^[\w-]{11}$/;

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

export class YouTubeError extends Error {}

// A channel link with its ID (youtube.com/channel/UC…), or a handle (youtube.com/@name or @name), which is looked up.
async function channelIdFrom(input: string): Promise<string | null> {
  const direct = input.match(/\b(UC[\w-]{22})\b/)?.[1];
  if (direct) return direct;
  const handle = input.match(/youtube\.com\/(@[\w.-]{3,30})/i)?.[1] ?? input.trim().match(/^(@[\w.-]{3,30})$/)?.[1];
  if (!handle) return null;
  // The handle is only letters, numbers, dots, dashes and underscores, so it goes in the address as it is.
  const response = await fetch(`${YOUTUBE_ORIGIN}/${handle}`, {
    // Skips the cookie-consent page YouTube shows to some regions.
    headers: { "Accept-Language": "en", Cookie: "CONSENT=YES+1; SOCS=CAI", "User-Agent": "Mozilla/5.0 (compatible; ChannahCakes/1.0)" },
  }).catch(() => null);
  if (!response?.ok) return null;
  const html = await response.text();
  return (
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ??
    html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ??
    html.match(/"channelId":"(UC[\w-]{22})"/)?.[1] ??
    null
  );
}

const decodeXml = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

export type YouTubeVideo = { id: string; title: string; published: string | null; thumbnail: string; url: string; short: boolean };

const cache = new Map<string, { at: number; videos: YouTubeVideo[] }>();

// The channel's latest uploads (YouTube's feed lists the newest 15), cached for 10 minutes.
export async function latestChannelVideos(channel: string): Promise<{ channelId: string; videos: YouTubeVideo[] }> {
  const channelId = await channelIdFrom(channel);
  if (!channelId) throw new YouTubeError("That doesn't look like a YouTube channel link.");
  const cached = cache.get(channelId);
  if (cached && Date.now() - cached.at < 10 * 60_000) return { channelId, videos: cached.videos };

  const response = await fetch(`${YOUTUBE_ORIGIN}/feeds/videos.xml?channel_id=${channelId}`, { headers: { "Accept-Language": "en" } }).catch(() => null);
  if (!response?.ok) throw new YouTubeError("YouTube didn't send the channel's videos just now.");
  const xml = await response.text();
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].flatMap(([, entry]) => {
    const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    if (!id) return [];
    const link = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? "";
    return [
      {
        id,
        title: decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
        published: entry.match(/<published>([^<]+)<\/published>/)?.[1] ?? null,
        thumbnail: youTubeThumbnail(id),
        url: youTubeWatchUrl(id),
        short: link.includes("/shorts/"),
      },
    ];
  });
  if (cache.size > 50) cache.clear();
  cache.set(channelId, { at: Date.now(), videos });
  return { channelId, videos };
}
