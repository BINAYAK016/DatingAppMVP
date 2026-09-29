FROM node:24.16.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24.16.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/schema.sql ./src/schema.sql
COPY --from=build /app/src/migrations ./src/migrations
COPY --from=build /app/src/admin.html ./src/admin.html
COPY --from=build /app/src/admin.js ./src/admin.js
RUN mkdir -p /data/media && chown -R node:node /data /app
USER node
EXPOSE 4100
CMD ["node", "dist/main.js"]
