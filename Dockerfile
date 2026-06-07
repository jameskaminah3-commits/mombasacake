FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN corepack enable

COPY . .

RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm run build

EXPOSE 3001

CMD ["corepack", "pnpm", "start"]
