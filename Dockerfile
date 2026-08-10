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
RUN npm run build

# Production stage
FROM node:22-slim AS runner

WORKDIR /app

# Copy built app and node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server-runtime ./server-runtime

# For TanStack Start / Nitro
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "./server-runtime/node-entry.mjs"]
