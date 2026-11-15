import type { MetadataRoute } from "next";

// Installable web app (PWA): "Add to Home Screen" on iOS/Android opens TrojanEngage full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TrojanEngage — USC events",
    short_name: "TrojanEngage",
    description: "Students swipe, orgs learn, and every event makes the next one better.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf9f7",
    theme_color: "#990000",
    categories: ["education", "social", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Feed", url: "/student/feed" },
      { name: "My Events", url: "/student/events" },
      { name: "Org dashboard", url: "/org/history" },
    ],
  };
}
