FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
RUN pnpm run -r build
RUN pnpm deploy --filter=@absinthe/uniswapv2 --prod /prod/uniswapv2
# RUN pnpm deploy --filter=app2 --prod /prod/app2

FROM base AS uniswapv2
COPY --from=build /prod/uniswapv2 /prod/uniswapv2
WORKDIR /prod/uniswapv2
CMD ["node", "lib/main.js"]

# FROM base AS app2
# COPY --from=build /prod/app2 /prod/app2
# WORKDIR /prod/app2
# CMD ["node", "lib/main.js"]