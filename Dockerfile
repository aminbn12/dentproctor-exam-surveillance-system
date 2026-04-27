# Multi-stage Dockerfile for DentProctor (Backend + Frontend)
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies like vite)
RUN npm ci

# Copy frontend source
COPY . .

# Build frontend (outputs to dist/)
RUN npm run build

# Stage 2: Backend (Python/FastAPI)
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/dist/ ./dist/

# Environment variables (Railway will override these)
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV DEBUG=false

# Expose port (Railway sets PORT automatically)
EXPOSE 8000

# Run server
CMD ["sh", "-c", "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
