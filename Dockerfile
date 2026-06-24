# Stage 1: Build the Expo Web app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the web bundle using Expo
RUN npm run build:web

# Stage 2: Serve the static files using NGINX
FROM nginx:alpine

# Remove default nginx index page
RUN rm -rf /usr/share/nginx/html/*

# Copy the built Expo web dist folder to Nginx's web root
COPY --from=builder /app/dist-web /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
