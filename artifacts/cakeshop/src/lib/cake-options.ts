import { useQuery } from "@tanstack/react-query";
import { customFetch, type Cake } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";
import { formatKes } from "@/lib/utils";

export type CakeFlavour = {
  name: string;
  description: string;
};

export type CakeOptions = {
  flavours: CakeFlavour[];
  // Cakes of at least this many kg may have an optional second flavour (e.g. one per tier); null turns it off.
  secondFlavourMinKg: number | null;
  // Sizes in kg offered on cakes without their own sizes, priced at the cake's price × kg; empty turns them off.
  standardSizesKg: number[];
};

export const STARTER_FLAVOURS: CakeFlavour[] = ["Vanilla", "Chocolate", "Red Velvet", "Black Forest", "White Forest", "Lemon", "Strawberry", "Marble"].map(
  (name) => ({ name, description: "" }),
);
export const DEFAULT_STANDARD_SIZES_KG = [1, 1.5, 2, 3, 4];

export const DEFAULT_CAKE_OPTIONS: CakeOptions = {
  flavours: STARTER_FLAVOURS,
  secondFlavourMinKg: 3,
  standardSizesKg: DEFAULT_STANDARD_SIZES_KG,
};

export async function fetchCakeOptions(): Promise<CakeOptions> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/cake-options`);
    if (!response.ok) return DEFAULT_CAKE_OPTIONS;
    const data = (await response.json()) as Partial<CakeOptions>;
    return {
      flavours: Array.isArray(data.flavours) ? data.flavours : [],
      secondFlavourMinKg: typeof data.secondFlavourMinKg === "number" ? data.secondFlavourMinKg : null,
      standardSizesKg: Array.isArray(data.standardSizesKg) ? data.standardSizesKg : DEFAULT_STANDARD_SIZES_KG,
    };
  } catch {
    return DEFAULT_CAKE_OPTIONS;
  }
}

// Shared by every page that shows sizes or flavours; undefined until the shop's settings have loaded.
export function useCakeOptions() {
  return useQuery({ queryKey: ["cake-options"], queryFn: fetchCakeOptions }).data;
}

export async function saveCakeOptions(options: CakeOptions): Promise<CakeOptions> {
  return customFetch<CakeOptions>(`${getApiBaseUrl()}/api/cake-options`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
}

export type CakeSize = { label: string; price: number };

// "1.5 kg": the same label the server uses when it prices standard sizes.
export function kgLabel(kg: number) {
  return `${Number(kg.toFixed(2))} kg`;
}

// The sizes a customer can choose: the cake's own sizes, or else the shop's standard sizes priced per kg
// (the cake's price is its 1 kg price). The server prices orders the same way.
export function cakeSizes(cake: Pick<Cake, "price" | "variants">, options: CakeOptions | undefined): CakeSize[] {
  if (cake.variants && cake.variants.length > 0) return cake.variants;
  if (!options || !(cake.price > 0)) return [];
  return options.standardSizesKg.map((kg) => ({ label: kgLabel(kg), price: Math.round(cake.price * kg) }));
}

export function cakePriceLabel(cake: Pick<Cake, "price" | "variants">, options?: CakeOptions) {
  const sizes = cakeSizes(cake, options);
  if (sizes.length > 1) return `From ${formatKes(Math.min(...sizes.map((size) => size.price)))}`;
  return formatKes(sizes[0]?.price ?? cake.price);
}

// Reads the weight from a size label: "3 kg" → 3, "2.5kg" → 2.5, "1/2 kg" → 0.5. Labels like "Large" have none.
export function sizeInKg(label: string | null | undefined): number | null {
  const match = label?.match(/(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?\s*kg/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  return match[2] ? amount / Number(match[2]) : amount;
}

export function offersSecondFlavour(options: CakeOptions, sizeLabel: string | null | undefined) {
  if (options.secondFlavourMinKg == null || options.flavours.length === 0) return false;
  const kg = sizeInKg(sizeLabel);
  return kg != null && kg >= options.secondFlavourMinKg;
}
