# ============================================
# 少年游 · 部署镜像
# 直接使用已构建好的前端 web/dist（内含高德 Key），不再在镜像内重建前端，
# 避免因缺少 VITE_AMAP_JS_KEY 构建参数导致地图 Key 丢失。
# ============================================
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server ./server
COPY web/dist ./web/dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
