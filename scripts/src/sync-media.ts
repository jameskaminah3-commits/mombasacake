import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type UploadTarget = {
  absolutePath: string;
  publicPath: string;
  contentType: string;
};

const IMAGE_EXTENSIONS = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".svg", "image/svg+xml"],
]);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function deriveSupabaseUrlFromDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const match = databaseUrl.match(/postgres\.([a-z0-9-]+):/i);
  if (!match?.[1]) return "";
  return `https://${match[1]}.supabase.co`;
}

function isValidSupabaseUrl(value: string) {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value.replace(/\/$/, ""));
}

function getSupabaseUrl() {
  const envUrl =
    process.env.SUPABASE_URL?.replace(/\/$/, "") ||
    process.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ||
    "";

  if (envUrl && isValidSupabaseUrl(envUrl)) {
    return envUrl;
  }

  return deriveSupabaseUrlFromDatabaseUrl().replace(/\/$/, "");
}

function getBucket() {
  return process.env.SUPABASE_MEDIA_BUCKET || process.env.VITE_SUPABASE_MEDIA_BUCKET || "cake-media";
}

function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function getSourceDir() {
  return path.resolve(REPO_ROOT, "artifacts", "cakeshop", "public");
}

function contentTypeForFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.get(ext) || null;
}

async function collectImageFiles(rootDir: string): Promise<UploadTarget[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const targets: UploadTarget[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      targets.push(...(await collectImageFiles(absolutePath)));
      continue;
    }

    const contentType = contentTypeForFile(absolutePath);
    if (!contentType) continue;

    targets.push({
      absolutePath,
      publicPath: path.relative(getSourceDir(), absolutePath).split(path.sep).join("/"),
      contentType,
    });
  }

  return targets;
}

function encodeStoragePath(publicPath: string) {
  return publicPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function uploadTarget(baseUrl: string, bucket: string, key: string, target: UploadTarget) {
  const body = await readFile(target.absolutePath);
  const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${encodeStoragePath(target.publicPath)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": target.contentType,
      "x-upsert": "true",
    },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${target.publicPath}: ${message || response.statusText}`);
  }
}

async function main() {
  const baseUrl = getSupabaseUrl();
  const bucket = getBucket();
  const key = getServiceRoleKey();
  const sourceDir = getSourceDir();
  const dryRun = process.argv.includes("--dry-run");

  if (!baseUrl) {
    throw new Error("Set SUPABASE_URL or provide a DATABASE_URL that contains your Supabase project ref.");
  }

  if (!key && !dryRun) {
    throw new Error("Set SUPABASE_SERVICE_ROLE_KEY before uploading media.");
  }

  const targets = await collectImageFiles(sourceDir);
  if (targets.length === 0) {
    console.log(`No image files found under ${sourceDir}`);
    return;
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Preparing ${targets.length} upload(s) to bucket "${bucket}"`);
  for (const target of targets) {
    if (dryRun) {
      console.log(`- ${target.publicPath}`);
      continue;
    }

    await uploadTarget(baseUrl, bucket, key, target);
    console.log(`Uploaded ${target.publicPath}`);
  }

  if (!dryRun) {
    console.log(`Done. Uploaded ${targets.length} image file(s) to ${bucket}.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
