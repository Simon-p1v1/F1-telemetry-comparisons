FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
# nginx:alpine processes *.template files in /etc/nginx/templates/ at startup via envsubst
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# When running standalone, point to the backend service name defined in docker-compose.yml
ENV BACKEND_URL=http://backend:8000

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
