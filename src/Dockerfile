FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Copy workspace files needed for dependency resolution
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/common/package.json ./packages/common/
COPY packages/common/tsconfig.json ./packages/common/
COPY projects/ichi/package.json ./projects/ichi/
COPY projects/ichi/tsconfig.json ./projects/ichi/

# Install all dependencies (including workspace deps)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --no-frozen-lockfile

# Build stage - build common package and current project
FROM base AS build
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY projects/ichi/ ./projects/ichi/

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/common/node_modules ./packages/common/node_modules
COPY --from=deps /app/projects/ichi/node_modules ./projects/ichi/node_modules

# Build the common package first, then ichi
WORKDIR /app
RUN pnpm --filter @absinthe/common build
RUN pnpm --filter @absinthe/ichi build

# Production stage
FROM base AS production
WORKDIR /app

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/common/node_modules ./packages/common/node_modules
COPY --from=deps /app/projects/ichi/node_modules ./projects/ichi/node_modules

# Copy built artifacts
COPY --from=build /app/packages/common/lib ./packages/common/lib
COPY --from=build /app/packages/common/package.json ./packages/common/
COPY --from=build /app/projects/ichi/lib ./projects/ichi/lib
COPY --from=build /app/projects/ichi/package.json ./projects/ichi/

# Copy additional files needed at runtime
COPY --from=build /app/projects/ichi/abi ./projects/ichi/abi
COPY --from=build /app/projects/ichi/schema.graphql ./projects/ichi/schema.graphql
COPY --from=build /app/projects/ichi/src ./projects/ichi/src
COPY --from=build /app/projects/ichi/tsconfig.json ./projects/ichi/
COPY --from=build /app/projects/ichi/db ./projects/ichi/db

WORKDIR /app/projects/ichi

# Use exec form and proper exit handling
CMD ["node", "lib/main.js"]
