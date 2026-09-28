import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/lib/api-base";

export type CakeFlavour = {
  name: string;
  description: string;
};

export type CakeOptions = {
  flavours: CakeFlavour[];
  // Cakes of at least this many kg may have an optional second flavour (e.g. one per tier); null turns it off.
  secondFlavourMinKg: number | null;
};

export const DEFAULT_CAKE_OPTIONS: CakeOptions = { flavours: [], secondFlavourMinKg: null };

export async function fetchCakeOptions(): Promise<CakeOptions> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/cake-options`);
    if (!response.ok) return DEFAULT_CAKE_OPTIONS;
    const data = (await response.json()) as Partial<CakeOptions>;
    return {
      flavours: Array.isArray(data.flavours) ? data.flavours : [],
      secondFlavourMinKg: typeof data.secondFlavourMinKg === "number" ? data.secondFlavourMinKg : null,
    };
  } catch {
    return DEFAULT_CAKE_OPTIONS;
  }
}

export async function saveCakeOptions(options: CakeOptions): Promise<CakeOptions> {
  return customFetch<CakeOptions>(`${getApiBaseUrl()}/api/cake-options`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
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
