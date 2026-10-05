import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { cakeMediaTable, db, type CakeMedia } from "@workspace/db";
import { logger } from "./logger";
import { normalizeSupabaseMediaUrl } from "./media-urls";
import { youTubeThumbnail, youTubeVideoId, youTubeWatchUrl } from "./youtube";

export const MAX_CAKE_MEDIA = 12;
export const MAX_CAKE_VIDEOS = 4;

let ensureCakeMediaSchemaPromise: Promise<void> | null = null;

export function ensureCakeMediaSchema(): Promise<void> {
  if (!ensureCakeMediaSchemaPromise) {
    ensureCakeMediaSchemaPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS cake_media (
          id serial PRIMARY KEY,
          cake_id integer NOT NULL,
          position integer NOT NULL DEFAULT 0,
          kind text NOT NULL,
          url text NOT NULL,
          poster_url text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS cake_media_cake_id_idx ON cake_media (cake_id, position)`);
    })().catch((error) => {
      ensureCakeMediaSchemaPromise = null;
      logger.error({ error }, "ensureCakeMediaSchema failed");
      throw error;
    });
  }
  return ensureCakeMediaSchemaPromise;
}

// Media shows in <img> and <video>, so only web addresses and the shop's own paths are allowed.
const mediaUrl = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((value) => /^https?:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//")), "Use an uploaded file's address");

// "youtube": a video from YouTube, played in the gallery. "video": a video file (from earlier versions).
export const CakeMediaItemSchema = z
  .object({
    type: z.enum(["image", "video", "youtube"]),
    url: mediaUrl,
    posterUrl: mediaUrl.nullish(),
  })
  .refine((item) => item.type !== "youtube" || youTubeVideoId(item.url) !== null, "That isn't a YouTube video link");

const isVideo = (item: { type: string }) => item.type === "video" || item.type === "youtube";

export const CakeMediaListSchema = z
  .array(CakeMediaItemSchema)
  .max(MAX_CAKE_MEDIA, `A cake can have up to ${MAX_CAKE_MEDIA} extra photos and videos`)
  .refine((items) => items.filter(isVideo).length <= MAX_CAKE_VIDEOS, `A cake can have up to ${MAX_CAKE_VIDEOS} videos`);

export type CakeMediaItem = { type: "image" | "video" | "youtube"; url: string; posterUrl: string | null };

// Photos are served through /api/media like the main image; video files keep their direct storage address,
// which streams them in pieces (what phones need to play video).
function formatMediaItem(row: Pick<CakeMedia, "kind" | "url" | "posterUrl">): CakeMediaItem {
  if (row.kind === "youtube") return { type: "youtube", url: row.url, posterUrl: row.posterUrl };
  const type = row.kind === "video" ? "video" : "image";
  return {
    type,
    url: type === "image" ? normalizeSupabaseMediaUrl(row.url) ?? row.url : row.url,
    posterUrl: normalizeSupabaseMediaUrl(row.posterUrl) ?? null,
  };
}

// What's stored: photos as /api/media addresses, YouTube videos as their watch link and YouTube's own thumbnail.
function storedMediaItem(item: z.infer<typeof CakeMediaItemSchema>) {
  if (item.type === "youtube") {
    const id = youTubeVideoId(item.url)!;
    return { kind: "youtube", url: youTubeWatchUrl(id), posterUrl: youTubeThumbnail(id) };
  }
  return {
    kind: item.type,
    url: item.type === "image" ? normalizeSupabaseMediaUrl(item.url) ?? item.url : item.url,
    posterUrl: normalizeSupabaseMediaUrl(item.posterUrl) ?? null,
  };
}

// Each cake's extra photos and videos, in order. If they can't be read, the shop still shows its cakes
// (with just their main photos) rather than failing.
export async function mediaForCakes(cakeIds: number[]): Promise<Map<number, CakeMediaItem[]>> {
  const byCake = new Map<number, CakeMediaItem[]>();
  if (cakeIds.length === 0) return byCake;
  try {
    await ensureCakeMediaSchema();
    const rows = await db
      .select()
      .from(cakeMediaTable)
      .where(inArray(cakeMediaTable.cakeId, cakeIds))
      .orderBy(asc(cakeMediaTable.cakeId), asc(cakeMediaTable.position), asc(cakeMediaTable.id));
    for (const row of rows) {
      byCake.set(row.cakeId, [...(byCake.get(row.cakeId) ?? []), formatMediaItem(row)]);
    }
  } catch (err) {
    logger.error({ err }, "Cake photos and videos unavailable");
  }
  return byCake;
}

export async function replaceCakeMedia(cakeId: number, items: z.infer<typeof CakeMediaListSchema>) {
  await ensureCakeMediaSchema();
  await db.transaction(async (tx) => {
    await tx.delete(cakeMediaTable).where(eq(cakeMediaTable.cakeId, cakeId));
    if (items.length === 0) return;
    await tx.insert(cakeMediaTable).values(items.map((item, position) => ({ cakeId, position, ...storedMediaItem(item) })));
  });
}

export async function deleteCakeMedia(cakeId: number) {
  await ensureCakeMediaSchema();
  await db.delete(cakeMediaTable).where(eq(cakeMediaTable.cakeId, cakeId));
}
