# Dockerfile (fixed - skip prestart hook in production)
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build argument for git commit hash
ARG GIT_COMMIT_SHA_LONG
ENV GIT_COMMIT_SHA_LONG=${GIT_COMMIT_SHA_LONG}

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy only root package files
COPY pnpm-lock.yaml package.json ./

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --no-frozen-lockfile

# Build stage
FROM base AS build
WORKDIR /app

# Copy source files
COPY pnpm-lock.yaml package.json tsconfig.json ./
COPY src/ ./src/
COPY adapters/ ./adapters/

# Copy node_modules
COPY --from=deps /app/node_modules ./node_modules

# Build
RUN pnpm build

# Production stage
FROM base AS production
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built code
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Copy adapters (needed for configs)
COPY --from=build /app/adapters ./adapters

# Copy src directory (needed for adapter imports at runtime)
COPY --from=build /app/src ./src

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node --eval "process.exit(0)" || exit 1

# Run directly with node (skip pnpm start to avoid prestart hook)
# think of a better solution to this
CMD ["node", "dist/src/main.js"]
