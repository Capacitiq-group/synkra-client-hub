# syntax=docker/dockerfile:1
# Using Debian-slim (glibc) rather than Alpine (musl) for both stages.
# Several build-time native binaries (@rollup/rollup-*, @tailwindcss/oxide-*)
# have unreliable musl/Alpine platform support and repeatedly hit npm's
# optional-dependency resolution bug (https://github.com/npm/cli/issues/4828)
# under Alpine. glibc targets for these packages are far better tested.
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies (copy .npmrc FIRST so npm sees legacy-peer-deps)
COPY package*.json ./
COPY .npmrc ./
# Remove any committed lockfile before installing, so npm resolves
# platform-specific optional dependencies fresh for this container rather
# than trusting a lockfile possibly generated on a different OS/architecture.
RUN rm -f package-lock.json
RUN npm install

# Copy source and build
COPY . .

# Vite bakes VITE_-prefixed vars into the client bundle at BUILD time, not
# runtime - setting them as ordinary Coolify environment variables on the
# service does nothing for these, since npm run build never sees them. They
# have to arrive as Docker build args instead (Coolify: set these under the
# service's "Build Variables", not "Environment Variables") and get
# re-exported as ENV here so `npm run build` below can actually read them.
ARG VITE_POCKETBASE_URL
ARG VITE_APP_URL
ARG VITE_APP_NAME
ARG VITE_API_URL
ARG VITE_LOOM_VIDEO_TEMPLATES
ARG VITE_LOOM_VIDEO_BUILDER
ARG VITE_LOOM_VIDEO_LOGS
ENV VITE_POCKETBASE_URL=${VITE_POCKETBASE_URL}
ENV VITE_APP_URL=${VITE_APP_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_LOOM_VIDEO_TEMPLATES=${VITE_LOOM_VIDEO_TEMPLATES}
ENV VITE_LOOM_VIDEO_BUILDER=${VITE_LOOM_VIDEO_BUILDER}
ENV VITE_LOOM_VIDEO_LOGS=${VITE_LOOM_VIDEO_LOGS}

RUN npm run build

# Production stage
FROM node:22-slim AS runner

WORKDIR /app

# vite.config.ts now uses the nitro/vite plugin with the node-server preset,
# which bundles all runtime dependencies into .output itself - node_modules
# is not needed here at all (previously copied, no longer necessary).
COPY --from=builder /app/.output ./.output

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
