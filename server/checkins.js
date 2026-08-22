// ============================================================
// 少年游 · 打卡手账（去过的地方，按用户持久化）
// - 每个用户一个文件：data/users/{phone}/checkins.json
// - 新增打卡时用高德 geocode 把地名解析成坐标，用于地图标记
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { geocode } from './tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function checkinFile(phone) {
  return join(DATA_DIR, 'users', phone, 'checkins.json');
}

export function listCheckins(phone) {
  if (!phone) return [];
  try { if (existsSync(checkinFile(phone))) return JSON.parse(readFileSync(checkinFile(phone), 'utf8')); } catch {}
  return [];
}

// 新增一条打卡（地点名 → 地理编码 → 坐标）
export async function addCheckin(phone, { name, date, time, note } = {}) {
  if (!phone) return { error: '未登录' };
  const n = String(name || '').trim();
  if (!n) return { error: '请输入地点名称' };
  const g = await geocode(n);
  const item = {
    id: randomBytes(6).toString('hex'),
    name: n,
    date: date || '',
    time: time || '',
    note: String(note || '').trim(),
    address: g.error ? '' : (g.name || ''),
    location: g.error ? '' : g.location,   // "lng,lat"
    createdAt: new Date().toISOString(),
  };
  const list = [item, ...listCheckins(phone)];
  mkdirSync(join(DATA_DIR, 'users', phone), { recursive: true });
  writeFileSync(checkinFile(phone), JSON.stringify(list, null, 2));
  return { ok: true, item };
}

export function removeCheckin(phone, id) {
  if (!phone) return { error: '未登录' };
  const list = listCheckins(phone).filter(c => c.id !== id);
  mkdirSync(join(DATA_DIR, 'users', phone), { recursive: true });
  writeFileSync(checkinFile(phone), JSON.stringify(list, null, 2));
  return { ok: true };
}
