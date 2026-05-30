FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm install

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate -w @arbix/api
RUN npm run build -w @arbix/shared && npm run build -w @arbix/config && npm run build -w @arbix/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages ./packages
COPY package.json ./
EXPOSE 4000
# Run Prisma migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma 2>/dev/null || true && node apps/api/dist/main.js"]
