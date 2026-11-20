FROM node:24-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src ./src
COPY public ./public
COPY expo/src/protocol.js ./expo/src/protocol.js
RUN npm run build

FROM node:24-bookworm-slim AS api-build
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npx tsc && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 STATIC_DIR=/app/web
WORKDIR /app
COPY --from=api-build --chown=node:node /app/node_modules ./node_modules
COPY --from=api-build --chown=node:node /app/dist ./dist
COPY --from=api-build --chown=node:node /app/package.json ./
COPY --from=web-build --chown=node:node /app/dist ./web
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
