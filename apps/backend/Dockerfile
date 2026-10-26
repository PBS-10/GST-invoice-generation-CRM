FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/backend/package.json apps/backend/
COPY packages/shared/package.json packages/shared/
COPY packages/validation/package.json packages/validation/
COPY packages/types/package.json packages/types/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @invoice-gst/shared build \
 && pnpm --filter @invoice-gst/validation build \
 && pnpm --filter @invoice-gst/types build \
 && pnpm --filter @invoice-gst/backend prisma:generate \
 && pnpm --filter @invoice-gst/backend exec tsc -p apps/backend/tsconfig.json || true

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app .
EXPOSE 3000
CMD ["pnpm", "--filter", "@invoice-gst/backend", "start"]
