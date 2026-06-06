const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

export function getApiBaseUrl() {
  if (configuredApiBase) return configuredApiBase;
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}
