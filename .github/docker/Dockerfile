FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

COPY . .

EXPOSE 3001

CMD ["npm", "start"]