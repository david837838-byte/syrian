FROM node:18-alpine

WORKDIR /app

# Install build dependencies if needed (e.g. for better-sqlite3 build)
RUN apk add --no-cache python3 make g++

COPY backend-node/package*.json ./backend-node/

WORKDIR /app/backend-node
RUN npm ci --omit=dev

WORKDIR /app
COPY . .

# Ensure data/uploads/logs directories exist
RUN mkdir -p logs uploads

EXPOSE 2000

CMD ["node", "backend-node/index.js"]