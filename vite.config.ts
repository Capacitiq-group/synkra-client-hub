import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
  },
  vite: {
    plugins: [
      {
        name: "csp-override",
        transformIndexHtml(html) {
          return html.replace(
            /connect-src 'self' https:\/\/pb\.synkra\.co\.za https:\/\/api\.synkra\.co\.za/,
            "connect-src 'self' https://pb.synkra.co.za https://api.synkra.co.za http://167.86.106.152:8093"
          );
        },
      },
    ],
  },
});
