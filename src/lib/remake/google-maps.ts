/// <reference types="google.maps" />

declare global {
  interface Window {
    __remakeMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

export const MAPS_AUTH_FAILED_EVENT = "remake-maps-auth-failed";
let loading: Promise<void> | null = null;

/** Load the Maps JavaScript API once (browser only; call from an effect). */
export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loading) return loading;
  const env = import.meta.env as Record<string, string | undefined>;
  const key =
    env["VITE_GOOGLE_MAPS_API_KEY"] || env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "";
  if (!key) return Promise.reject(new Error("Google Maps is not configured."));
  loading = new Promise<void>((resolve, reject) => {
    window.__remakeMapsReady = () => resolve();
    window.gm_authFailure = () => window.dispatchEvent(new Event(MAPS_AUTH_FAILED_EVENT));
    const s = document.createElement("script");
    const channelParam = channel ? `&channel=${encodeURIComponent(channel)}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__remakeMapsReady${channelParam}&region=GM&language=en`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("Couldn't load Google Maps. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return loading;
}
