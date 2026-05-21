FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

EXPOSE 3000

VOLUME ["/data"]

ENV NODE_ENV=production
ENV AI_RATE_LIMIT_STORE_PATH=/data/rate-limit-store.json

CMD ["node", "dist/server.cjs"]
