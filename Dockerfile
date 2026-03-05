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

# Start the application
CMD ["node", "server.js"]