import type { MetadataRoute } from "next";

// Web app manifest — makes EduConnect installable as a PWA ("Add to Home
// Screen"), e.g. on iPhone where there is no app download. Icons are generated
// by scripts/generate-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "EduConnect AI",
    short_name: "EduConnect",
    description: "Connection, wellbeing and learning for every student — with privacy and safety built in.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#d93a3a",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
