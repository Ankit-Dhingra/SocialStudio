FROM node:20-slim

# Install Chromium, FFmpeg, and TrueType fonts needed for Remotion rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-noto-color-emoji \
    fonts-freefont-ttf \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Remotion & Puppeteer container flags
ENV CHROME_EXECUTABLE=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu"
ENV PORT=4000
ENV NODE_OPTIONS="--max-old-space-size=250"

WORKDIR /app

# Copy package manifests & install
COPY package*.json ./
RUN npm ci --include=dev

# Copy codebase
COPY . .

# Pre-bundle Remotion composition at build time so runtime has 0% Webpack CPU load
RUN npm run bundle:remotion

ENV NODE_ENV=production

# Expose API port
EXPOSE 4000

# Start API + in-process BullMQ Worker
CMD ["npm", "start"]
