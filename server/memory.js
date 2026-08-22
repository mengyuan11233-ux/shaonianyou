// ============================================================
// 少年游 · Memory（长期用户偏好，JSON 文件持久化，免数据库）
// - 按用户隔离：data/users/{userId}/memory.json
// - 未登录访客使用 userId = 'default'
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const LEGACY_MEMORY_FILE = join(DATA_DIR, 'memory.json');

const DEFAULT = {
  userId: 'default',
  preferences: [],   // 喜欢的旅行类型：美食/拍照打卡/咖啡...
  dislikes: [],      // 不喜欢：早起/高强度步行...
  budgetHabit: '',   // 预算习惯
  travelStyle: '',   // 旅行风格：松弛休闲/特种兵...
  visitHistory: [],  // 历史行程记录
};

function sanitizeUserId(userId) {
  return String(userId || 'default').replace(/[^\w.-]/g, '_');
}

function memoryFile(userId) {
  return join(DATA_DIR, 'users', userId, 'memory.json');
}

export function loadMemory(userId = 'default') {
  const uid = sanitizeUserId(userId);
  const file = memoryFile(uid);
  try {
    if (existsSync(file)) return { ...DEFAULT, userId: uid, ...JSON.parse(readFileSync(file, 'utf8')) };
  } catch {}
  // 兼容旧的单用户 memory.json（仅 default 访客）
  if (uid === 'default' && existsSync(LEGACY_MEMORY_FILE)) {
    try { return { ...DEFAULT, ...JSON.parse(readFileSync(LEGACY_MEMORY_FILE, 'utf8')) }; } catch {}
  }
  return { ...DEFAULT, userId: uid };
}

export function saveMemory(userId, m) {
  const uid = sanitizeUserId(userId);
  mkdirSync(join(DATA_DIR, 'users', uid), { recursive: true });
  writeFileSync(memoryFile(uid), JSON.stringify(m, null, 2));
}

export function updateMemory(userId = 'default', updates = {}) {
  const uid = sanitizeUserId(userId);
  const m = loadMemory(uid);
  // preferences/dislikes：默认累加（规划时逐渐积累），updates.replace=true 时整体覆盖（手动编辑）
  if (Array.isArray(updates.preferences)) {
    m.preferences = updates.replace
      ? [...new Set(updates.preferences)]
      : [...new Set([...m.preferences, ...updates.preferences])];
  }
  if (Array.isArray(updates.dislikes)) {
    m.dislikes = updates.replace
      ? [...new Set(updates.dislikes)]
      : [...new Set([...m.dislikes, ...updates.dislikes])];
  }
  // 字符串字段：只要字段出现就写入（允许清空）
  if (updates.budgetHabit !== undefined) m.budgetHabit = updates.budgetHabit;
  if (updates.travelStyle !== undefined) m.travelStyle = updates.travelStyle;
  saveMemory(uid, m);
  return m;
}

export function memoryToPrompt(m) {
  const parts = [];
  if (m.preferences.length) parts.push(`偏好：${m.preferences.join('、')}`);
  if (m.dislikes.length) parts.push(`不喜欢：${m.dislikes.join('、')}`);
  if (m.budgetHabit) parts.push(`预算习惯：${m.budgetHabit}`);
  if (m.travelStyle) parts.push(`旅行风格：${m.travelStyle}`);
  return parts.join('；');
}
