# 少年游 · AI 智能旅行规划

> 欲买桂花同载酒，终不似，少年游。

基于 **AI Agent + 高德地图 + 实时旅行数据** 的移动端旅行规划 Web App。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js（内置 http）+ DeepSeek（OpenAI 兼容）+ 高德 Web服务 API |
| 前端 | Vue 3 + Vite + Vant + 高德地图 JS API |
| 存储 | JSON 文件（`data/`，免数据库） |

## 目录结构

```
现在就出发/
├── server/           # 后端
│   ├── index.js      # HTTP 服务 + SSE 流式进度
│   ├── planner.js    # Agent 编排（工具调用 → 规划 → 校验）
│   ├── tools.js      # 高德工具集 + 工具注册表
│   ├── prompts.js    # 系统提示词
│   ├── memory.js     # 用户偏好记忆
│   └── validate.js   # 行程校验 + JSON 提取
├── web/              # 前端
│   ├── src/
│   │   ├── App.vue
│   │   ├── api.js    # SSE 流式调用
│   │   ├── map.js    # 高德地图加载
│   │   └── views/    # Home / Form / Progress / Itinerary / MapView
│   └── vite.config.js  # /api 代理到后端
├── spike.mjs         # 早期技术验证脚本（可忽略）
├── .env              # 环境变量（已 gitignore）
└── .env.example      # 环境变量模板
```

## 环境配置（`.env`）

需要两个高德 Key（**类型不同，不能混用**）：

| 变量 | 说明 | 类型 |
|---|---|---|
| `AMAP_WEB_SERVICE_KEY` | 后端 geocode/POI/天气/路线 | 高德「Web服务」 |
| `VITE_AMAP_JS_KEY` | 前端地图渲染（填在 `web/.env`） | 高德「Web端(JS API)」 |
| `VITE_AMAP_SECURITY_CODE` | JS API 安全密钥 | 同上 |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | DeepSeek | — |

> ⚠️ JS API Key 需在[高德控制台](https://console.amap.com)给该 Key 配置**域名白名单**（本地开发填 `localhost`），否则浏览器里地图会加载失败。

## 运行

**最简单：一条命令**

```bash
npm start
```

浏览器打开 **http://localhost:3000** 即可（后端会同时托管前端页面，一个端口搞定）。

> 前端代码改动后需要重新构建：`npm run build`。
> 开发调试时也可以走 Vite 热更新：`cd web && npm run dev`（端口 5173，自动代理后端）。

## 已实现功能（MVP 闭环）

1. ✅ 首页情绪开场 + 点击探索
2. ✅ 需求输入（目的地/日期/人数/关系/预算/偏好/自然语言）
3. ✅ AI 生成过程 SSE 流式进度
4. ✅ 真实天气（高德）+ 真实景点/餐厅/酒店 POI
5. ✅ LLM 规划每日行程（天气/距离/预算决策）
6. ✅ 行程总览 + 高德地图打点 + 点击行程联动定位
7. ✅ 每日行程时间轴 + 酒店推荐 + 预算拆分
8. ✅ 旅行中 AI 重规划（"下雨了/起晚了/不想去"）
9. ✅ 用户偏好记忆（Memory）

## 诚实说明（真实数据边界）

- **酒店实时价格**：预订类 API 需企业资质，无法接入。当前用高德 POI 的**真实酒店名称/位置/评分**，价格档位缺失时不显示、不伪造。
- **POI 评分/人均**：高德 `place/detail` 的 `biz_ext` 覆盖不全，有则显示、无则隐藏。
