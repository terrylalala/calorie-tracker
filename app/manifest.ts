import type { MetadataRoute } from "next";

/**
 * PWA manifest. Next serves this at /manifest.webmanifest and links it
 * automatically.
 *
 * iOS uses app/apple-icon.png for the Home Screen and ignores these `icons`
 * entirely; they are here for Android and general installability. Before this
 * existed the app shipped no icon at all, so iOS fell back to rendering a
 * letter tile.
 *
 * Colours match the app's warm-cream theme (globals.css --bg, and the themeColor
 * already set in layout.tsx) so the splash screen and status bar do not flash a
 * different shade on launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Display name only — see the note in layout.tsx. Short enough at 10
    // characters that short_name can match rather than abbreviate.
    name: "AI Cal Boy",
    short_name: "AI Cal Boy",
    description:
      "Snap a photo of your food and track calories & macros with Gemini.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e7",
    theme_color: "#f6f1e7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
