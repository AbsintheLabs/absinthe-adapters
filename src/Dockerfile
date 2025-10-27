# Dockerfile
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

# Copy package files
COPY pnpm-lock.yaml package.json ./

# Install ALL dependencies (including dev deps needed for build)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Build stage
FROM base AS build
WORKDIR /app

# Copy package files and config
COPY pnpm-lock.yaml package.json tsconfig.json ./

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source files (these layers will invalidate when files change)
COPY src/ ./src/
COPY adapters/ ./adapters/

# Build (this will re-run if src/ or adapters/ changed)
RUN pnpm build

# Production stage
FROM base AS production
WORKDIR /app

# Copy ONLY production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built artifacts (will be fresh from build stage)
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./

# Copy adapters (needed for runtime)
COPY --from=build /app/adapters ./adapters

# Copy src directory (needed for adapter imports at runtime)
COPY --from=build /app/src ./src

# Copy and make executable the entrypoint script
COPY --from=build /app/src/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node --eval "process.exit(0)" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]