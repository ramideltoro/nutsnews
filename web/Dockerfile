# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22
ARG SOURCE_REPOSITORY=https://github.com/ramideltoro/nutsnews
ARG NUTSNEWS_SOURCE_COMMIT=unknown
ARG NUTSNEWS_BUILD_ID=unknown
ARG NUTSNEWS_DEPLOYMENT_TARGET=vps

FROM node:${NODE_VERSION}-bookworm-slim AS dependencies

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /app

ARG NUTSNEWS_SOURCE_COMMIT
ARG NUTSNEWS_BUILD_ID
ARG NUTSNEWS_DEPLOYMENT_TARGET

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NUTSNEWS_SOURCE_COMMIT=${NUTSNEWS_SOURCE_COMMIT} \
    NUTSNEWS_BUILD_ID=${NUTSNEWS_BUILD_ID} \
    NUTSNEWS_DEPLOYMENT_TARGET=${NUTSNEWS_DEPLOYMENT_TARGET} \
    NUTSNEWS_RUNTIME_ENV=staging \
    NUTSNEWS_SIDE_EFFECTS_MODE=disabled \
    NUTSNEWS_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
    NUTSNEWS_PUBLIC_SUPABASE_ANON_KEY=build-time-fixture-anon-key

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runner

WORKDIR /app

ARG SOURCE_REPOSITORY
ARG NUTSNEWS_SOURCE_COMMIT
ARG NUTSNEWS_BUILD_ID
ARG NUTSNEWS_DEPLOYMENT_TARGET

LABEL org.opencontainers.image.title="NutsNews" \
      org.opencontainers.image.description="NutsNews Next.js web application" \
      org.opencontainers.image.source="${SOURCE_REPOSITORY}" \
      org.opencontainers.image.revision="${NUTSNEWS_SOURCE_COMMIT}" \
      io.nutsnews.build.id="${NUTSNEWS_BUILD_ID}" \
      io.nutsnews.deployment.target="${NUTSNEWS_DEPLOYMENT_TARGET}"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NUTSNEWS_SOURCE_COMMIT=${NUTSNEWS_SOURCE_COMMIT} \
    NUTSNEWS_BUILD_ID=${NUTSNEWS_BUILD_ID} \
    NUTSNEWS_DEPLOYMENT_TARGET=${NUTSNEWS_DEPLOYMENT_TARGET}

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

RUN mkdir -p .next/cache && chown -R node:node .next

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz',{signal:AbortSignal.timeout(4000)}).then(async(response)=>{const body=await response.json();if(!response.ok||body.ok!==true){process.exit(1)}}).catch(()=>process.exit(1))"]

CMD ["node", "server.js"]
