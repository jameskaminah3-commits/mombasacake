import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import {
  deleteSupabaseMedia,
  getSupabaseMediaMaxBytes,
  uploadSupabaseMedia,
} from "@/lib/supabase-media";

type AdminImageUploadProps = {
  label: string;
  folder: string;
  value: string;
  onChange: (url: string) => void;
  onClear?: () => void;
  helperText?: string;
};

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/avif";

export function AdminImageUpload({
  label,
  folder,
  value,
  onChange,
  onClear,
  helperText,
}: AdminImageUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { token } = useAuth();
  const { toast } = useToast();

  const maxBytes = getSupabaseMediaMaxBytes();
  const maxMb = Math.round((maxBytes / 1024 / 1024) * 10) / 10;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      setIsUploading(true);
      const { url } = await uploadSupabaseMedia(file, token || "", folder);
      if (value && value !== url) {
        try {
          await deleteSupabaseMedia(value, token || "");
        } catch {
          // Swallow cleanup failures so a successful replacement does not block the editor.
        }
      }
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
            <img src={value} alt={label} className="h-full w-full object-cover" />
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
            {value ? "Change image" : "Upload image"}
          </Button>
            {value && onClear && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    setIsUploading(true);
                    await deleteSupabaseMedia(value, token || "");
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
    </div>
  );
}
