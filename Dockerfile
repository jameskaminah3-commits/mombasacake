FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN corepack enable

COPY . .

RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm run build

EXPOSE 3001

# The image already holds the built shop and server, so the container only starts the server.
# (`pnpm start` builds everything again first, which needs about 1 GB of memory: on small Railway
# plans it was killed during start-up and new versions never went live.)
WORKDIR /app/artifacts/api-server
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
