import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
    hooks: {
      "render:html": (html) => {
        if (html.body && html.body.includes("connect-src 'self' https://pb.synkra.co.za https://api.synkra.co.za")) {
          html.body = html.body.replace(
            "connect-src 'self' https://pb.synkra.co.za https://api.synkra.co.za",
            "connect-src 'self' https://pb.synkra.co.za https://api.synkra.co.za http://167.86.106.152:8093"
          );
        }
      },
    },
  },
});
