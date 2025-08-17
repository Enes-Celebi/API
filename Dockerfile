# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app

# Enable pnpm (via Corepack) and install deps deterministically
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate \
 && pnpm i --frozen-lockfile

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# Build TS
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Bring runtime artifacts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./

# Default to API; worker overrides CMD in compose
CMD ["node", "dist/server.js"]
