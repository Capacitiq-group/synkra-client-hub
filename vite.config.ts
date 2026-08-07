import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackStartVite } from "@tanstack/react-start/plugin/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    TanStackStartVite(),
    react(),
    tsConfigPaths(),
  ],
});
