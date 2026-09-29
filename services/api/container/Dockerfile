# Cloudflare Containers require linux/amd64
FROM --platform=linux/amd64 debian:bookworm-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js and necessary dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    wget \
    unzip \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# Install Chrome runtime dependencies (Puppeteer downloads its own Chrome)
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
    libvulkan1 \
    libegl1 \
    libgl1 \
    libgles2 \
    && rm -rf /var/lib/apt/lists/*

# GPU hosts (Cloud Run NVIDIA L4) mount the driver at /usr/local/nvidia/lib64; point the Vulkan and
# EGL loaders at it. Harmless on CPU-only hosts, where STREAM_GPU stays unset.
ENV LD_LIBRARY_PATH=/usr/local/nvidia/lib64
RUN mkdir -p /etc/vulkan/icd.d /usr/share/glvnd/egl_vendor.d \
    && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /etc/vulkan/icd.d/nvidia_icd.json \
    && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json

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

# Explicitly download Chrome for Puppeteer (postinstall may be skipped)
RUN npx puppeteer browsers install chrome

# Copy source and extension
COPY . .

# Run the app using tsx to handle TypeScript
EXPOSE 8080
EXPOSE 40000-40100/udp
CMD ["npm", "start"]
