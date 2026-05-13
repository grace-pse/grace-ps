FROM node:26-bookworm-slim AS deps
RUN npm install -g pnpm@9
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY client/package.json client/
COPY shared/package.json shared/
RUN pnpm install --frozen-lockfile=false

FROM node:26-bookworm-slim AS builder
RUN npm install -g pnpm@9
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/client/node_modules ./client/node_modules
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY . .
ARG VITE_SANDBOX_MODE=
ARG VITE_RESET_INTERVAL_HOURS=
ARG VITE_APP_VERSION=dev
ARG VITE_GIT_SHA=unknown
ENV VITE_SANDBOX_MODE=${VITE_SANDBOX_MODE}
ENV VITE_RESET_INTERVAL_HOURS=${VITE_RESET_INTERVAL_HOURS}
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
ENV VITE_GIT_SHA=${VITE_GIT_SHA}
RUN pnpm --filter=@csmp/shared build || true
RUN pnpm --filter=@csmp/client build

FROM nginx:alpine AS runner
COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
