import type { MetadataRoute } from "next";
import theme from "../pwa-theme.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aarili",
    short_name: "Aarili",
    description: "Online boutique workspace / இணைய தையல் நிலைய நிர்வாகம்",
    lang: "en",
    start_url: "/owner",
    scope: "/",
    display: "standalone",
    background_color: theme.background,
    theme_color: theme.primary,
    icons: [
      {
        src: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
