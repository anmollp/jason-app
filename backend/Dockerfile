# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-bookworm-slim
ARG RUST_VERSION=1-bookworm
ARG JASON_CLI_REF=v1.6.0

FROM rust:${RUST_VERSION} AS jason-cli

ARG JASON_CLI_REF

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build/jason

RUN git clone --depth 1 --branch "${JASON_CLI_REF}" https://github.com/anmollp/jason.git . \
  && cargo build --release --locked

FROM node:${NODE_VERSION} AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile

FROM node:${NODE_VERSION} AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"

RUN corepack enable

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm run build \
  && pnpm prune --prod

FROM node:${NODE_VERSION} AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV JASON_CLI_PATH=/usr/local/bin/jason

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=jason-cli /build/jason/target/release/jason /usr/local/bin/jason

EXPOSE 3000

CMD ["node", "dist/main.js"]
