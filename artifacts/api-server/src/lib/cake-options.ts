import { z } from "zod";
import { readStoreSetting, writeStoreSetting } from "./store-settings";

const SETTINGS_KEY = "cake-options";

// Shop-wide cake choices, edited in Admin → Cakes: the flavours customers pick from on every cake page, and the
// standard sizes offered on cakes that have no sizes of their own.
export const CakeOptionsSchema = z.object({
  // An empty list hides the flavour question.
  flavours: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        description: z.string().trim().max(120).optional().default(""),
      }),
    )
    .max(40),
  // Cakes of at least this many kg may have an optional second flavour (e.g. one per tier). Null turns it off.
  secondFlavourMinKg: z.number().positive().max(100).nullable().optional().default(null),
  // Sizes in kg for cakes without their own sizes, each priced at the cake's price × kg (the cake's price is its
  // 1 kg price). An empty list turns them off.
  standardSizesKg: z.array(z.number().positive().max(100)).max(12).optional(),
});

export type CakeOptions = Omit<z.infer<typeof CakeOptionsSchema>, "standardSizesKg"> & { standardSizesKg: number[] };

export const STARTER_FLAVOURS = ["Vanilla", "Chocolate", "Red Velvet", "Black Forest", "White Forest", "Lemon", "Strawberry", "Marble"].map(
  (name) => ({ name, description: "" }),
);
export const DEFAULT_STANDARD_SIZES_KG = [1, 1.5, 2, 3, 4];

export const DEFAULT_CAKE_OPTIONS: CakeOptions = {
  flavours: STARTER_FLAVOURS,
  secondFlavourMinKg: 3,
  standardSizesKg: DEFAULT_STANDARD_SIZES_KG,
};

export async function readCakeOptions(): Promise<CakeOptions> {
  const saved = CakeOptionsSchema.safeParse(await readStoreSetting(SETTINGS_KEY));
  if (!saved.success) return DEFAULT_CAKE_OPTIONS;
  // Saved before standard sizes existed with no flavours: the shop hadn't set its flavours up yet.
  const notSetUp = saved.data.standardSizesKg === undefined && saved.data.flavours.length === 0;
  if (notSetUp) return DEFAULT_CAKE_OPTIONS;
  return { ...saved.data, standardSizesKg: saved.data.standardSizesKg ?? DEFAULT_STANDARD_SIZES_KG };
}

export async function writeCakeOptions(options: CakeOptions): Promise<CakeOptions> {
  const sizes = [...new Set(options.standardSizesKg)].sort((a, b) => a - b);
  const clean = { ...options, standardSizesKg: sizes };
  await writeStoreSetting(SETTINGS_KEY, clean);
  return clean;
}

export type CakeSize = { label: string; price: number };

export function kgLabel(kg: number) {
  return `${Number(kg.toFixed(2))} kg`;
}

function parseOwnSizes(value: string | null | undefined): CakeSize[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is CakeSize => typeof v === "object" && v !== null && typeof v.label === "string" && typeof v.price === "number",
    );
  } catch {
    return [];
  }
}

// The sizes a customer can choose for a cake: its own sizes, or else the shop's standard sizes priced per kg.
export function cakeSizes(cake: { price: string; variants: string | null }, options: CakeOptions): CakeSize[] {
  const own = parseOwnSizes(cake.variants);
  if (own.length > 0) return own;
  const pricePerKg = parseFloat(cake.price);
  if (!Number.isFinite(pricePerKg) || pricePerKg <= 0) return [];
  return options.standardSizesKg.map((kg) => ({ label: kgLabel(kg), price: Math.round(pricePerKg * kg) }));
}
