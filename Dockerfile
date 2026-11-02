FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Hosting platforms (e.g. Render) set HOSTNAME to the container name at runtime,
# which overrides ENV; the CMD forces 0.0.0.0 so the server is reachable. PORT comes from the platform.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
# The standalone build bundles drizzle-orm into the app, but the migration
# script imports it directly, so ship the installed packages too.
COPY --from=deps /app/node_modules ./node_modules
USER app
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && HOSTNAME=0.0.0.0 node server.js"]
