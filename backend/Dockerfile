FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY syllabi ./syllabi

RUN npm ci
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=base /app/syllabi ./syllabi

EXPOSE 4000
CMD ["node", "dist/server.js"]

FROM base AS worker
ENV NODE_ENV=production
CMD ["node", "dist/worker.js"]

FROM base AS migrator
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]
