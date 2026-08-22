// ============================================================
// 少年游 · 行程存储（按用户持久化，JSON 文件，免数据库）
// - 每个用户一个文件：data/users/{phone}/plans.json
// - 同一「城市 + 出发日期」的行程视为同一程，重复保存时覆盖，避免堆积
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const MAX_PLANS = 30;

function planFile(phone) {
  return join(DATA_DIR, 'users', phone, 'plans.json');
}

export function listUserPlans(phone) {
  if (!phone) return [];
  try { if (existsSync(planFile(phone))) return JSON.parse(readFileSync(planFile(phone), 'utf8')); } catch {}
  return [];
}

// 保存一份行程（同一城市+日期覆盖，否则插入最前）
export function saveUserPlan(phone, plan) {
  if (!phone || !plan || !plan.city) return null;
  const list = listUserPlans(phone);
  const date = plan.days?.[0]?.date || '';
  const item = {
    id: randomBytes(8).toString('hex'),
    city: plan.city,
    days: plan.days?.length || 0,
    date,
    savedAt: new Date().toISOString(),
    plan,
  };
  const idx = list.findIndex(p => p.city === plan.city && p.date === date);
  if (idx >= 0) list[idx] = item; else list.unshift(item);
  const trimmed = list.slice(0, MAX_PLANS);
  mkdirSync(join(DATA_DIR, 'users', phone), { recursive: true });
  writeFileSync(planFile(phone), JSON.stringify(trimmed, null, 2));
  return item;
}
