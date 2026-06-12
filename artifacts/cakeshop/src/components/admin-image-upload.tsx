import { useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Search, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  fetchSupabaseMediaLibrary,
  getSupabaseMediaMaxBytes,
  normalizeSupabaseMediaUrl,
  uploadSupabaseMedia,
} from "@/lib/supabase-media";

type AdminImageUploadProps = {
  label: string;
  folder: string;
  value: string;
  onChange: (url: string) => void;
  onClear?: () => void;
  helperText?: string;
  allowLibrarySelect?: boolean;
  defaultLibraryScope?: "folder" | "all";
};

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/avif";

export function AdminImageUpload({
  label,
  folder,
  value,
  onChange,
  onClear,
  helperText,
  allowLibrarySelect = true,
  defaultLibraryScope = "folder",
}: AdminImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryScope, setLibraryScope] = useState<"folder" | "all">(defaultLibraryScope);
  const { token } = useAuth();
  const { toast } = useToast();

  const maxBytes = getSupabaseMediaMaxBytes();
  const maxMb = Math.round((maxBytes / 1024 / 1024) * 10) / 10;
  const normalizedValue = normalizeSupabaseMediaUrl(value) || value;

  const { data: libraryItems = [], isFetching: isLibraryLoading } = useQuery({
    queryKey: ["media-library", folder, libraryScope],
    queryFn: () => fetchSupabaseMediaLibrary(token || "", libraryScope === "folder" ? folder : undefined, 48),
    enabled: isLibraryOpen && Boolean(token),
    staleTime: 1000 * 60,
  });

  const filteredLibraryItems = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!query) return libraryItems;
    return libraryItems.filter((item) =>
      [item.filename, item.path, item.folder]
        .filter(Boolean)
        .some((entry) => entry.toLowerCase().includes(query)),
    );
  }, [libraryItems, librarySearch]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setIsUploading(true);
      const { url } = await uploadSupabaseMedia(file, token || "", folder);
      onChange(url);
      toast({
        title: `${label} uploaded`,
        description: `Stored in Supabase and limited to ${maxMb} MB.`,
      });
    } catch (error) {
      toast({
        title: `Failed to upload ${label.toLowerCase()}`,
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="h-24 w-full shrink-0 overflow-hidden rounded-md bg-background sm:h-20 sm:w-20">
          {value ? (
            <img
              src={normalizeSupabaseMediaUrl(value) || value}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP, or AVIF up to {maxMb} MB.
              {helperText ? ` ${helperText}` : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {value ? "Upload a different image" : "Upload new image"}
            </Button>
            {allowLibrarySelect && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsLibraryOpen(true)}
                disabled={isUploading}
              >
                <Search className="h-4 w-4" />
                Choose from existing uploads
              </Button>
            )}
            {allowLibrarySelect && (
              <Button asChild type="button" variant="ghost" size="sm" className="px-2 text-muted-foreground">
                <Link href="/media-library">Open media library</Link>
              </Button>
            )}
            {value && onClear && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    setIsUploading(true);
                    onClear();
                  } catch (error) {
                    toast({
                      title: `Failed to remove ${label.toLowerCase()}`,
                      description: error instanceof Error ? error.message : "Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsUploading(false);
                  }
                }}
                disabled={isUploading}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <DialogContent className="max-h-[90dvh] max-w-5xl overflow-hidden p-0">
          <div className="grid max-h-[90dvh] gap-0 md:grid-cols-[280px_1fr]">
            <DialogHeader className="border-b p-5 text-left md:border-b-0 md:border-r">
              <DialogTitle>Choose from existing uploads</DialogTitle>
              <DialogDescription>
                Reuse an image already stored in Supabase, or switch to a different folder if needed.
              </DialogDescription>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/20 p-1">
                  <Button
                    type="button"
                    variant={libraryScope === "folder" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLibraryScope("folder")}
                    className="h-8"
                  >
                    This folder
                  </Button>
                  <Button
                    type="button"
                    variant={libraryScope === "all" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLibraryScope("all")}
                    className="h-8"
                  >
                    All uploads
                  </Button>
                </div>
                <Input
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="Search filename or path"
                />
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current selection</p>
                  <div className="mt-2 flex items-start gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-background">
                      {normalizedValue ? (
                        <img src={normalizedValue} alt={label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{label}</p>
                      <p className="break-all text-xs text-muted-foreground">
                        {normalizedValue || "No image selected yet"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 p-5">
              <ScrollArea className="h-[min(70dvh,700px)] pr-3">
                {isLibraryLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <div key={index} className="aspect-square animate-pulse rounded-xl bg-muted/40" />
                    ))}
                  </div>
                ) : filteredLibraryItems.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredLibraryItems.map((item) => {
                      const isSelected = normalizedValue === item.url;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => {
                            onChange(item.url);
                            setIsLibraryOpen(false);
                          }}
                          className={`group overflow-hidden rounded-xl border text-left transition-all ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/25"
                              : "border-border hover:border-primary/40 hover:shadow-md"
                          }`}
                        >
                          <div className="aspect-square bg-muted/30">
                            <img
                              src={item.url}
                              alt={item.filename}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                          <div className="space-y-1 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium">{item.filename}</p>
                              {isSelected && (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                  Selected
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">{item.folder || "root"}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "Recently uploaded"}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed bg-muted/20 p-8 text-center">
                    <div className="max-w-sm space-y-2">
                      <p className="font-medium">No matching media found</p>
                      <p className="text-sm text-muted-foreground">
                        Upload an image first, or clear the search field to see all images in this folder.
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
