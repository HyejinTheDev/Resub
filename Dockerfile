FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN npm ci

COPY frontend ./frontend
COPY backend ./backend

RUN npm run build

# Create downloads directories and assign permissions to user 1000 (node) for Hugging Face compatibility
RUN mkdir -p /app/backend/downloads/videos \
             /app/backend/downloads/audios \
             /app/backend/downloads/exports \
             /app/backend/downloads/temp_tts \
  && chown -R 1000:1000 /app

ENV NODE_ENV=production
ENV PORT=7860

USER 1000

EXPOSE 7860

CMD ["npm", "start"]
