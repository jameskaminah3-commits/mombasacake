import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  itemName: string;
  size?: "sm" | "md";
  variant?: "outline" | "filled";
  disableDecrease?: boolean;
  className?: string;
};

export function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  itemName,
  size = "md",
  variant = "outline",
  disableDecrease = false,
  className,
}: QuantityStepperProps) {
  const buttonSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full",
        variant === "filled" ? "bg-primary text-primary-foreground" : "border border-border bg-background",
        className,
      )}
    >
      <button
        type="button"
        onClick={onDecrease}
        disabled={disableDecrease}
        aria-label={`Remove one ${itemName}`}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors disabled:opacity-40",
          variant === "filled" ? "hover:bg-black/10" : "hover:bg-muted",
          buttonSize,
        )}
      >
        <Minus className={iconSize} />
      </button>
      <span className={cn("text-center font-bold tabular-nums", size === "sm" ? "min-w-6 text-sm" : "min-w-8")} aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={`Add one more ${itemName}`}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors",
          variant === "filled" ? "hover:bg-black/10" : "hover:bg-muted",
          buttonSize,
        )}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}
