// ============================================================
// 少年游 · 后端 HTTP 服务（Node 内置 http + SSE 流式进度）
// 启动：npm start  （默认端口 3000，可用 PORT 覆盖）
// ============================================================

import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planTrip, replanTrip } from './planner.js';
import { getPoiDetail } from './tools.js';
import { loadMemory, updateMemory, memoryToPrompt } from './memory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DIST_DIR = join(__dirname, '..', 'web', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  try { return JSON.parse(body || '{}'); } catch { return {}; }
}

// 提供前端静态文件（web/dist），找不到则回退到 index.html（SPA）
async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET') return false;
  let filePath = resolve(DIST_DIR, '.' + pathname);
  if (!filePath.startsWith(DIST_DIR)) return false;
  try {
    let st = await stat(filePath);
    if (st.isDirectory()) filePath = join(filePath, 'index.html');
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
    return true;
  } catch {
    try {
      const data = await readFile(join(DIST_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
      return true;
    } catch {
      return false;
    }
  }
}

const server = createServer(async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // 健康检查
  if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true });

  // 读取 / 更新 Memory
  if (req.method === 'GET' && path === '/api/memory') return json(res, 200, loadMemory());
  if (req.method === 'POST' && path === '/api/memory') {
    const m = updateMemory(await readBody(req));
    return json(res, 200, m);
  }

  // POI 详情（前端地点详情弹窗）
  if (req.method === 'GET' && path.startsWith('/api/poi/')) {
    const id = decodeURIComponent(path.slice('/api/poi/'.length));
    const detail = await getPoiDetail(id);
    return json(res, detail.error ? 404 : 200, detail);
  }

  // 规划（SSE 流式进度）
  if (req.method === 'POST' && path === '/api/plan') {
    const { request } = await readBody(req);
    if (!request) return json(res, 400, { error: '缺少 request 字段' });
    const memory = loadMemory();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    try {
      const { plan, issues } = await planTrip(request, {
        memoryText: memoryToPrompt(memory),
        onProgress: (e) => sendSSE(res, e),
      });
      sendSSE(res, { type: 'done', plan, issues });
    } catch (err) {
      sendSSE(res, { type: 'error', message: err.message });
    } finally {
      res.end();
    }
    return;
  }

  // 重新规划（SSE 流式进度）
  if (req.method === 'POST' && path === '/api/replan') {
    const { plan, message } = await readBody(req);
    if (!plan || !message) return json(res, 400, { error: '缺少 plan 或 message 字段' });
    const memory = loadMemory();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    try {
      const { plan: newPlan, issues } = await replanTrip(plan, message, {
        memoryText: memoryToPrompt(memory),
        onProgress: (e) => sendSSE(res, e),
      });
      sendSSE(res, { type: 'done', plan: newPlan, issues });
    } catch (err) {
      sendSSE(res, { type: 'error', message: err.message });
    } finally {
      res.end();
    }
    return;
  }

  // 静态资源（前端构建产物 web/dist）
  if (!path.startsWith('/api/')) {
    if (await serveStatic(req, res, path)) return;
  }

  return json(res, 404, { error: 'Not Found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`🚀 少年游后端已启动：http://localhost:${PORT}`));
