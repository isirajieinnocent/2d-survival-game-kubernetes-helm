# ===== Build Stage =====
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root package files and tsconfig files
COPY package.json package-lock.json ./
COPY tsconfig*.json ./

# Install dependencies from root
RUN npm ci

# Copy ALL source code from current directory into /app
COPY . ./

# Build the client
RUN npm run build

# ===== Production Stage =====
FROM node:22-alpine AS production
WORKDIR /app

# Copy built client from builder
COPY --from=builder /app/dist ./dist

# Install a simple static server
RUN npm install -g serve

EXPOSE 80

# Run the built client
CMD ["serve", "-s", "dist", "-l", "80"]