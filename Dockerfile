# Base image is node:22-slim, we cannot use node:22-alpine because of
# a known issue for arm/v7 architecture (hangs on dependency installation)
# see https://github.com/nodejs/docker-node/issues/2077
FROM node:22-slim AS builder

# Set the working directory for the app
WORKDIR /app

# `--frozen-lockfile` checks the lockfile against the WHOLE workspace, not just
# the packages this image builds: the root manifest, which carries the pnpm
# settings, plus every package `pnpm-workspace.yaml` globs. A manifest that is
# missing here fails the build with ERR_PNPM_OUTDATED_LOCKFILE, and a missing
# root one with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH. Keep this list covering
# packages/*, even for packages the image never compiles.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/app-client/package.json packages/app-client/package.json
COPY packages/app-server/package.json packages/app-server/package.json
COPY packages/cli/package.json packages/cli/package.json
COPY packages/crypto/package.json packages/crypto/package.json
COPY packages/deploy-cloudflare/package.json packages/deploy-cloudflare/package.json
COPY packages/docs/package.json packages/docs/package.json
COPY packages/lib/package.json packages/lib/package.json

# Install the pnpm version the repo pins. Taking whatever is latest means the
# toolchain changes under us: pnpm 10 moved `overrides` out of package.json, so
# a newer pnpm reads none and `--frozen-lockfile` rejects the lockfile.
RUN npm install -g "pnpm@$(node -p "require('./package.json').packageManager.split('@')[1]")" --ignore-scripts \
 && pnpm install --frozen-lockfile --ignore-scripts

# Copy the entire app
COPY . .

# Build the apps
RUN pnpm --filter @secreto/crypto --fail-if-no-match run build && \
    pnpm --filter @secreto/lib --fail-if-no-match run build && \
    pnpm --filter @secreto/app-client --fail-if-no-match run build && \
    pnpm --filter @secreto/app-server --fail-if-no-match run build:node

# Production image 
FROM node:22-alpine

WORKDIR /app

# Copy the built apps
COPY --from=builder /app/packages/app-client/dist ./public
COPY --from=builder /app/packages/app-server/dist-node/index.cjs ./index.cjs

# Create the .data directory 
RUN mkdir -p /app/.data 

EXPOSE 8787

CMD ["node", "index.cjs"]