FROM node:22.12.0-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies without cache mount to avoid EBUSY errors
RUN npm ci --prefer-offline --no-audit

# Copy application files
COPY . .

# Build the application
RUN npm run build

# Install serve globally
RUN npm install -g serve

# Start the application (serve automatically binds to Railway's $PORT)
CMD ["serve", "-s", "dist"]