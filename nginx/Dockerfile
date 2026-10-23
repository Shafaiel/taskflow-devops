# Custom Nginx image: serves the TaskFlow front end and reverse-proxies /api to the Node.js API.
# Build context is the project root (see docker-compose.yml) so it can copy ./frontend.
FROM nginx:1.27-alpine
LABEL description="TaskFlow front end + reverse proxy"

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/taskflow.conf
COPY frontend/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
