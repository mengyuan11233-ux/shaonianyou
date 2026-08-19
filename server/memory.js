// ============================================================
// 少年游 · Memory（长期用户偏好，JSON 文件持久化，免数据库）
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const MEMORY_FILE = join(DATA_DIR, 'memory.json');

const DEFAULT = {
  userId: 'default',
  preferences: [],   // 喜欢的旅行类型：美食/拍照打卡/咖啡...
  dislikes: [],      // 不喜欢：早起/高强度步行...
  budgetHabit: '',   // 预算习惯
  travelStyle: '',   // 旅行风格：松弛休闲/特种兵...
  visitHistory: [],  // 历史行程记录
};

export function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) return { ...DEFAULT, ...JSON.parse(readFileSync(MEMORY_FILE, 'utf8')) };
  } catch {}
  return { ...DEFAULT };
}

export function saveMemory(m) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(MEMORY_FILE, JSON.stringify(m, null, 2));
}

export function updateMemory(updates = {}) {
  const m = loadMemory();
  if (Array.isArray(updates.preferences)) m.preferences = [...new Set([...m.preferences, ...updates.preferences])];
  if (Array.isArray(updates.dislikes)) m.dislikes = [...new Set([...m.dislikes, ...updates.dislikes])];
  if (updates.budgetHabit) m.budgetHabit = updates.budgetHabit;
  if (updates.travelStyle) m.travelStyle = updates.travelStyle;
  saveMemory(m);
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
