FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Render's dashboard env vars are only injected at container runtime, not into this
# build stage — declaring it as a build ARG (Render passes matching-named env vars
# through automatically) is what actually gets it into the Vite build, since
# import.meta.env.VITE_* is inlined at build time, not read at runtime.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
