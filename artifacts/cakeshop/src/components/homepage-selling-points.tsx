import { ChevronRight } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { highlightIcon, type Highlight } from "@/lib/homepage-highlights";
import { WHATSAPP_CUSTOM_CAKE_URL } from "@/lib/store-info";
import { cn } from "@/lib/utils";

const COLUMNS = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];

// Short reasons to order, in a row under the category photos. Also used for the preview in the admin panel.
export function HighlightsRow({ highlights, className }: { highlights: Highlight[]; className?: string }) {
  if (highlights.length === 0) return null;
  return (
    <ul className={cn("grid gap-2", COLUMNS[Math.min(highlights.length, COLUMNS.length) - 1], className)} aria-label="Why order from us">
      {highlights.map(({ icon, label }, index) => {
        const Icon = highlightIcon(icon);
        return (
          <li key={`${index}-${label}`} className="flex flex-col items-center gap-1 rounded-xl bg-muted/60 px-1.5 py-2.5 text-center">
            <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-balance break-words text-[11px] font-semibold leading-tight text-foreground/80">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}

// WhatsApp button for customers with their own design; the preview in the admin panel doesn't link anywhere.
export function CustomCakeButton({ title, text, preview = false }: { title: string; text: string; preview?: boolean }) {
  const className = "flex items-center gap-3 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-4 text-left transition-colors";
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
        <SiWhatsapp className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        {text && <span className="block text-xs leading-5 text-muted-foreground">{text}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );

  if (preview) return <div className={className}>{content}</div>;
  return (
    <a href={WHATSAPP_CUSTOM_CAKE_URL} target="_blank" rel="noopener noreferrer" className={cn(className, "hover:bg-[#25D366]/15")}>
      {content}
    </a>
  );
}
