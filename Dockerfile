FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=development
ENV API_PORT=3001
ENV RENDER_APP_URL=http://localhost:5173

EXPOSE 5173 3001

CMD ["npm", "run", "dev:all"]
