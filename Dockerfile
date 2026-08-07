# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (copy .npmrc FIRST so npm sees legacy-peer-deps)
COPY package*.json ./
COPY .npmrc ./
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

# For TanStack Start / Nitro
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "./dist/server/index.mjs"]
