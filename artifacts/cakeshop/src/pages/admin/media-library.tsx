import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { FolderOpen, Image as ImageIcon, Link2, Loader2, Search, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSupabaseMediaLibrary,
  getSupabaseMediaBucket,
  uploadSupabaseMedia,
  type SupabaseMediaLibraryItem,
} from "@/lib/supabase-media";

const QUICK_FOLDERS = ["all", "homepage-gallery", "homepage-hero", "promotions", "uploads"] as const;

function formatSize(size: number | null) {
  if (!size || Number.isNaN(size)) return "Unknown size";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = size / 1024;
  return `${kb.toFixed(0)} KB`;
}

export default function AdminMediaLibrary() {
  const { token } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<(typeof QUICK_FOLDERS)[number]>("all");
  const [uploadFolder, setUploadFolder] = useState("uploads");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SupabaseMediaLibraryItem | null>(null);

  const { data: libraryItems = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-media-library"],
    queryFn: () => fetchSupabaseMediaLibrary(token || "", undefined, 120),
    enabled: Boolean(token),
    staleTime: 1000 * 30,
  });

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return libraryItems.filter((item) => {
      if (folderFilter !== "all" && item.folder !== folderFilter) return false;
      if (!query) return true;
      return [item.filename, item.path, item.folder].some((value) => value.toLowerCase().includes(query));
    });
  }, [folderFilter, libraryItems, search]);

  const sortedItems = useMemo(
    () =>
      [...filteredItems].sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      }),
    [filteredItems],
  );

  async function handleUpload(file: File) {
    if (!token) return;
    try {
      setIsUploading(true);
      const uploaded = await uploadSupabaseMedia(file, token, uploadFolder || "uploads");
      toast({
        title: "Image uploaded",
        description: "Stored in Supabase and ready to reuse anywhere in the admin.",
      });
      setSelectedItem({
        path: uploaded.path,
        url: uploaded.url,
        filename: file.name,
        folder: uploaded.path.includes("/") ? uploaded.path.slice(0, uploaded.path.lastIndexOf("/")) : "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mimeType: file.type || null,
        size: file.size,
      });
      await refetch();
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }

  const handleCopy = async (item: SupabaseMediaLibraryItem) => {
    try {
      await navigator.clipboard.writeText(item.url);
      toast({
        title: "Media URL copied",
        description: "Paste this URL into any image field if needed.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  };

  const selected = selectedItem ?? sortedItems[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Media Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse every uploaded Supabase image, upload new files, and copy URLs for reuse in homepage content.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <FolderOpen className="h-4 w-4 text-primary" />
          Bucket: {getSupabaseMediaBucket()}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold">Upload New Image</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload to a folder, then reuse the same stored image from Homepage Hero or Homepage Gallery.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Destination folder</label>
              <Input
                value={uploadFolder}
                onChange={(event) => setUploadFolder(event.target.value)}
                placeholder="uploads"
              />
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Upload from device</p>
                  <p className="text-sm text-muted-foreground">JPG, PNG, WebP, or AVIF.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="gap-2"
                >
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload image
                </Button>
                <Button asChild variant="outline">
                  <Link href="/homepage">Go to Homepage Editor</Link>
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                await handleUpload(file);
              }}
            />

            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm font-semibold">Quick filters</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_FOLDERS.map((folder) => (
                  <Button
                    key={folder}
                    type="button"
                    variant={folderFilter === folder ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFolderFilter(folder)}
                  >
                    {folder === "all" ? "All uploads" : folder}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Stored Images</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Click any image to inspect it, or copy the URL for reuse elsewhere.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search filename or folder"
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" onClick={() => refetch()}>
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-64 w-full rounded-2xl" />
                ))}
              </div>
            ) : sortedItems.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {sortedItems.map((item) => {
                  const isSelected = selected?.path === item.path;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className={`overflow-hidden rounded-2xl border text-left transition-all ${
                        isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className="aspect-square bg-muted/20">
                        <img src={item.url} alt={item.filename} className="h-full w-full object-cover" />
                      </div>
                      <div className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.filename}</p>
                            <p className="truncate text-xs text-muted-foreground">{item.folder || "root"}</p>
                          </div>
                          {isSelected && <Badge>Selected</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "Recently uploaded"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center">
                <div className="max-w-sm space-y-2">
                  <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="font-medium">No images found</p>
                  <p className="text-sm text-muted-foreground">
                    Upload a file or clear the current filters to see more results.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Selected Image</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Copy the URL or open the file directly if you want to reuse it elsewhere.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => selected && handleCopy(selected)}
              disabled={!selected}
              className="gap-2"
            >
              <Link2 className="h-4 w-4" />
              Copy URL
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {selected ? (
            <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
              <div className="overflow-hidden rounded-2xl border bg-muted/10">
                <img src={selected.url} alt={selected.filename} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-4 rounded-2xl border bg-muted/10 p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filename</p>
                  <p className="mt-1 break-all font-medium">{selected.filename}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Path</p>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{selected.path}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Folder</p>
                    <p className="mt-1 text-sm">{selected.folder || "root"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Size</p>
                    <p className="mt-1 text-sm">{formatSize(selected.size)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</p>
                    <p className="mt-1 text-sm">{selected.mimeType || "Unknown"}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="gap-2">
                    <a href={selected.url} target="_blank" rel="noreferrer">
                      Open image
                    </a>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleCopy(selected)} className="gap-2">
                    <Link2 className="h-4 w-4" />
                    Copy URL
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Select an image from the library to view its details.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
