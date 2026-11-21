FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 MEDIA_STORAGE_ROOT=/var/data/salvadora/media
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.js ./
COPY public ./public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
USER node
CMD ["node", "server.js"]
