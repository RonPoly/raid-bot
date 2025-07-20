FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
RUN npm prune --production
CMD ["node", "dist/index.js"]
