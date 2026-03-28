# Cloudflare Containers require linux/amd64
FROM --platform=linux/amd64 debian:bullseye-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and necessary dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    wget \
    unzip \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install Chromium, Xvfb, and dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Virtual display for Chrome (headless:false + Xvfb enables tab capture)
ENV DISPLAY=:99

# Mark that we're running in Docker for Chrome configuration
ENV DOCKER_ENVIRONMENT=true

# Install tsx for TypeScript execution
RUN npm install -g tsx

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source and extension
COPY . .

# Start Xvfb then the app
EXPOSE 8080
EXPOSE 40000-40100/udp
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x720x24 -ac &>/dev/null & sleep 2 && exec npm start"]
