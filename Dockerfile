FROM node:20-alpine AS base
WORKDIR /app

# Instalar dependencias
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Build de la aplicación
FROM deps AS build
ARG VITE_API_URL=http://localhost:6543
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN npm run build

# Servidor de producción
FROM base AS prod
RUN npm install -g vite
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/index.html ./index.html
COPY package.json ./

EXPOSE 5173
CMD ["vite", "preview", "--host", "0.0.0.0", "--port", "5173"]

