FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=production
ENV PORT=4001
EXPOSE 4001
CMD ["npx", "tsx", "index.ts"]