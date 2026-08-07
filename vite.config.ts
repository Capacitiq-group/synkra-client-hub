import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: {
    preset: "node-server",
    hooks: {
      "render:response": (response) => {
        const csp = response.headers?.["Content-Security-Policy"];
        if (csp && typeof csp === "string") {
          response.headers["Content-Security-Policy"] = csp.replace(
            "connect-src 'self' https://pb.synkra.co.za https://api.synkra.co.za",
            "connect-src 'self' https://pb.synkra.co.za https://api.synkra.co.za http://167.86.106.152:8093"
          );
        }
      },
    },
  },
});
