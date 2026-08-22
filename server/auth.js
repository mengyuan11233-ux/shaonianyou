// ============================================================
// 少年游 · 账号系统（手机号 + 密码，JSON 文件持久化，免数据库）
// - 密码用 scrypt 加盐哈希存储，不存明文
// - 登录成功后签发随机 token，存 data/sessions.json
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');
const SESSIONS_FILE = join(DATA_DIR, 'sessions.json');

function readJSON(file, fallback) {
  try { if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')); } catch {}
  return fallback;
}
function writeJSON(file, data) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadUsers() { return readJSON(USERS_FILE, {}); }
function saveUsers(u) { writeJSON(USERS_FILE, u); }
function loadSessions() { return readJSON(SESSIONS_FILE, {}); }
function saveSessions(s) { writeJSON(SESSIONS_FILE, s); }

const PHONE_RE = /^1[3-9]\d{9}$/;

// 密码加盐哈希（scrypt）
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const test = scryptSync(password, salt, 64);
  const ref = Buffer.from(hash, 'hex');
  return test.length === ref.length && timingSafeEqual(test, ref);
}

function createSession(phone) {
  const token = randomBytes(24).toString('hex');
  const sessions = loadSessions();
  sessions[token] = phone;
  saveSessions(sessions);
  return token;
}

// 注册（成功后直接登录，返回 token）
export function register(phone, password) {
  if (!PHONE_RE.test(phone)) return { error: '请输入正确的 11 位手机号' };
  if (typeof password !== 'string' || password.length < 6) return { error: '密码至少 6 位' };
  const users = loadUsers();
  if (users[phone]) return { error: '该手机号已注册，请直接登录' };
  const { salt, hash } = hashPassword(password);
  users[phone] = { phone, salt, hash, createdAt: new Date().toISOString() };
  saveUsers(users);
  return { token: createSession(phone), phone };
}

// 登录
export function login(phone, password) {
  const users = loadUsers();
  const u = users[phone];
  if (!u || !verifyPassword(password, u.salt, u.hash)) return { error: '手机号或密码错误' };
  return { token: createSession(phone), phone };
}

// 退出登录（删除会话）
export function logout(token) {
  if (!token) return;
  const sessions = loadSessions();
  if (sessions[token]) { delete sessions[token]; saveSessions(sessions); }
}

// token → 手机号（无效返回 null）
export function phoneByToken(token) {
  if (!token) return null;
  return loadSessions()[token] || null;
}

// 从请求头解析 Bearer token
export function getTokenFromReq(req) {
  const auth = req.headers['authorization'] || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}
