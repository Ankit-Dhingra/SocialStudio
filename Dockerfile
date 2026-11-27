FROM node:22-slim AS app

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN mkdir -p /app/media/tmp
ENV TMPDIR=/app/media/tmp

FROM app AS generation
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "src/studio-worker.ts", "generation"]

FROM app AS renderer

# Install system libraries for headless browser, FFmpeg, and TrueType fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    ffmpeg \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Pre-download and cache Remotion headless browser binary at build time
RUN node -e "require('@remotion/renderer').ensureBrowser().then(r => console.log('✔ [Build] Browser ensured:', r))"

# Pre-bundle Remotion composition at build time so runtime has 0% Webpack CPU load
RUN npm run bundle:remotion

ENV NODE_ENV=production
CMD ["node", "--import", "tsx", "src/studio-worker.ts", "render"]

FROM app AS api
ENV NODE_ENV=production PORT=4000
ENV NODE_OPTIONS="--max-old-space-size=320"
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/api.ts"]
