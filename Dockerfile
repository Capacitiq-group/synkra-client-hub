# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (copy .npmrc FIRST so npm sees legacy-peer-deps)
COPY package*.json ./
COPY .npmrc ./
# Remove any committed lockfile before installing. Rollup ships
# platform-specific optional native binaries (e.g. @rollup/rollup-linux-x64-musl),
# and a lockfile generated on a different OS/architecture can cause npm to
# skip installing the correct one for this Alpine/musl build container
# (see https://github.com/npm/cli/issues/4828). Deleting it forces a fresh,
# platform-correct resolution.
RUN rm -f package-lock.json
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

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
