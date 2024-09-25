# Use the official Puppeteer image
FROM ghcr.io/puppeteer/puppeteer:19.11.1

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

USER root

# Install dependencies (including Puppeteer)
RUN npm install

# specify the cache directory
# (took me a while to figure out why chrome could not be started)
# ENV PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

RUN npm remove puppeteer
RUN npm install puppeteer

# Copy the rest of the application code
COPY . .

# Build the TypeScript application
RUN npm run build

# Expose the port if you have a server running
EXPOSE 3000

USER pptruser

# default command to run the server
CMD ["node", "dist/task2.js"]
