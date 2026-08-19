# ============================================
# 少年游 · 部署镜像（多阶段构建）
# 阶段1：构建前端；阶段2：运行后端 + 托管前端
# ============================================

# ---- 阶段 1：构建前端（公开的高德 JS Key 通过 build args 传入）----
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
ARG VITE_AMAP_JS_KEY
ARG VITE_AMAP_SECURITY_CODE
ENV VITE_AMAP_JS_KEY=$VITE_AMAP_JS_KEY
ENV VITE_AMAP_SECURITY_CODE=$VITE_AMAP_SECURITY_CODE
RUN npm run build

# ---- 阶段 2：运行时 ----
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server ./server
COPY --from=web-builder /app/web/dist ./web/dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.js"]
