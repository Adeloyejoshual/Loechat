# Dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production

# Copy worker and other files (including your firebase service account JSON)
COPY . .

# Ensure the service account JSON path matches FIREBASE_CERT_PATH env var
ENV NODE_ENV=production

EXPOSE 4000
CMD ["node", "billingWorker.js"]