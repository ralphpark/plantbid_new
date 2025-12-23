import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // React 코어
          'vendor-react': ['react', 'react-dom'],
          // 라우팅 & 상태관리
          'vendor-router': ['wouter', '@tanstack/react-query'],
          // UI 컴포넌트 (Radix)
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
          ],
          // 애니메이션
          'vendor-motion': ['framer-motion'],
          // 차트
          'vendor-charts': ['recharts'],
          // 지도
          'vendor-maps': ['@react-google-maps/api'],
          // 폼
          'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // 유틸리티
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'lucide-react'],
        },
      },
    },
  },
});
