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

# Install Chrome/Chromium runtime dependencies (but NOT system chromium —
# Puppeteer downloads its own compatible Chrome version)
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Mark that we're running in Docker for Chrome configuration
ENV DOCKER_ENVIRONMENT=true

# Install tsx for TypeScript execution
RUN npm install -g tsx

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (Puppeteer will download compatible Chrome)
RUN npm ci

# Copy source and extension
COPY . .

# Run the app using tsx to handle TypeScript
EXPOSE 8080
# Expose UDP port range for WebRTC media connections
EXPOSE 40000-40100/udp
CMD ["npm", "start"]
