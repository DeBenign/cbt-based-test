import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Benchmark CBT",
        short_name: "Benchmark",
        description: "Computer-based testing for schools",
        theme_color: "#3D5AFE",
        background_color: "#F7F8FB",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Precache only the built app shell (JS/CSS/HTML/fonts/images). No
        // API routes are listed here, on purpose -- /api/* must always hit
        // the network, never a cached response. Exam data, scores, and auth
        // are never safe to serve stale.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//]
      }
    })
  ]
});