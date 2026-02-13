# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arg for API URL (set at build time)
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

# Build the app
RUN npm run build

# ---- Production stage: serve with Nginx ----
FROM nginx:alpine AS production

# Copy built files to Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config for SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
