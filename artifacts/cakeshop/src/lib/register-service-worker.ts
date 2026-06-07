export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Silent fallback: the app still works without offline caching.
    });
  });
}
