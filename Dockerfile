FROM node:20-slim

# Install system libraries for headless browser, FFmpeg, and TrueType fonts
RUN apt-get update && apt-get install -y \
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

ENV PORT=4000

WORKDIR /app

# Copy package manifests & install
COPY package*.json ./
RUN npm ci --include=dev

# Pre-download and cache Remotion headless browser binary at build time
RUN node -e "require('@remotion/renderer').ensureBrowser().then(r => console.log('✔ [Build] Browser ensured:', r))"

# Copy codebase
COPY . .

# Pre-bundle Remotion composition at build time so runtime has 0% Webpack CPU load
RUN npm run bundle:remotion

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=160"

# Expose API port
EXPOSE 4000

# Start API + in-process BullMQ Worker
CMD ["npm", "start"]
