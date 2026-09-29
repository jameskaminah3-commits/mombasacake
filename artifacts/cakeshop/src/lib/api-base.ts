// The shop and its API are served by the same server, so API calls go to whichever address the page was
// opened on (www, the bare domain or the Railway address). A fixed API address would break every other one:
// browsers block those cross-site calls whenever that address stops answering with CORS headers.
// In local development the Vite dev server forwards /api to the API server the same way.
export function getApiBaseUrl() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "";
}
