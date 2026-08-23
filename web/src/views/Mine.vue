<script setup>
import { ref, computed, onMounted } from 'vue';
import { authHeaders } from '../auth.js';
import MapView from './MapView.vue';

const props = defineProps({ user: Object, plans: Array });
const emit = defineEmits(['login', 'logout', 'open-plan']);

const memory = ref(null);
const loading = ref(true);

// —— 打卡手账 ——
const checkins = ref([]);
const focusIndex = ref(null);
const showCheckin = ref(false);
const cName = ref('');
const cDate = ref('');
const cTime = ref('');
const cNote = ref('');
const savingCheckin = ref(false);

// —— 习惯编辑 ——
const showHabits = ref(false);
const hPrefs = ref('');
const hDislikes = ref('');
const hStyle = ref('');
const hBudget = ref('');
const savingHabits = ref(false);

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function localTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function loadMemory() {
  try {
    const r = await fetch('/api/memory', { headers: authHeaders() });
    memory.value = await r.json();
  } catch {}
  finally { loading.value = false; }
}

async function loadCheckins() {
  if (!props.user) { checkins.value = []; return; }
  try {
    const r = await fetch('/api/checkins', { headers: authHeaders() });
    if (r.ok) checkins.value = await r.json();
  } catch {}
}

onMounted(() => { loadMemory(); loadCheckins(); });

const checkinMarkers = computed(() =>
  checkins.value.filter(c => c.location).map(c => ({ name: c.name, location: c.location, type: 'checkin' }))
);

function openCheckin() {
  cName.value = ''; cDate.value = localDate(); cTime.value = localTime(); cNote.value = '';
  showCheckin.value = true;
}

async function submitCheckin() {
  const name = cName.value.trim();
  if (!name) return alert('请输入地点名称');
  savingCheckin.value = true;
  try {
    const r = await fetch('/api/checkins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name, date: cDate.value, time: cTime.value, note: cNote.value }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || '打卡失败');
    showCheckin.value = false;
    await loadCheckins();
  } catch (e) { alert(e.message || '打卡失败'); }
  finally { savingCheckin.value = false; }
}

async function removeCheckin(id) {
  try {
    await fetch('/api/checkins/' + encodeURIComponent(id), { method: 'DELETE', headers: authHeaders() });
    await loadCheckins();
  } catch {}
}

// —— 习惯编辑 ——
function split(s) { return s.split(/[、,，\s]+/).map(x => x.trim()).filter(Boolean); }

function openHabits() {
  hPrefs.value = (memory.value?.preferences || []).join('、');
  hDislikes.value = (memory.value?.dislikes || []).join('、');
  hStyle.value = memory.value?.travelStyle || '';
  hBudget.value = memory.value?.budgetHabit || '';
  showHabits.value = true;
}

async function submitHabits() {
  savingHabits.value = true;
  try {
    const r = await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        preferences: split(hPrefs.value),
        dislikes: split(hDislikes.value),
        travelStyle: hStyle.value.trim(),
        budgetHabit: hBudget.value.trim(),
        replace: true,   // 手动编辑 → 整体覆盖，不累加
      }),
    });
    memory.value = await r.json();
    showHabits.value = false;
  } catch { alert('保存失败'); }
  finally { savingHabits.value = false; }
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
</script>

<template>
  <div class="page">
    <div class="mine-title hand">我的旅行手账</div>
    <p class="muted" style="margin-bottom:20px">小游会慢慢记住你的喜好</p>

    <!-- 登录卡片 -->
    <div v-if="!user" class="card login-card">
      <div class="login-emoji">🔐</div>
      <div class="login-title play">登录后，行程自动保存</div>
      <p class="muted" style="margin:6px 0 14px">换手机、刷新页面都不怕丢，还能打卡记录你去过的地方</p>
      <button class="btn-main" @click="emit('login')">手机号登录 / 注册</button>
    </div>

    <!-- 已登录：账号信息 + 历史行程 -->
    <template v-else>
      <div class="card account-card">
        <div class="acc-row">
          <span class="acc-avatar">👤</span>
          <div>
            <div class="acc-phone play">{{ user.phone }}</div>
            <div class="muted">已登录 · 行程已同步云端</div>
          </div>
          <button class="logout-btn play" @click="emit('logout')">退出</button>
        </div>
      </div>

      <div class="section-title">🧳 我的行程</div>
      <div v-if="plans?.length" class="plan-list">
        <div v-for="p in plans" :key="p.id" class="card plan-card" @click="emit('open-plan', p)">
          <div class="plan-city play">{{ p.city }}</div>
          <div class="plan-meta muted">{{ p.days }}天{{ (p.days || 1) - 1 }}晚 · {{ p.date }} · 保存于 {{ fmtDate(p.savedAt) }}</div>
          <span class="plan-arrow play">查看行程 →</span>
        </div>
      </div>
      <div v-else class="card muted">还没有保存的行程，规划一程后会自动出现在这里</div>

      <!-- 打卡手账 -->
      <div class="section-title">📍 打卡手账</div>
      <div v-if="checkinMarkers.length" class="card checkin-map-card">
        <MapView :markers="checkinMarkers" :focus-index="focusIndex" height="32vh" />
      </div>
      <div v-if="checkins.length" class="checkin-list">
        <div v-for="(c, i) in checkins" :key="c.id" class="card checkin-card" @click="focusIndex = i">
          <button class="ck-del" @click.stop="removeCheckin(c.id)">✕</button>
          <div class="ck-name play">📌 {{ c.name }}</div>
          <div class="muted">{{ c.date }}<template v-if="c.time"> · {{ c.time }}</template><template v-if="c.address"> · {{ c.address }}</template></div>
          <div v-if="c.note" class="hand-note ck-note">「{{ c.note }}」</div>
        </div>
      </div>
      <div v-else class="card muted">还没打卡过，点下面记下你去过的地方吧</div>
      <button class="add-checkin-btn play" @click="openCheckin">＋ 打卡一个地方</button>
    </template>

    <!-- 我的习惯（可编辑） -->
    <div class="habits-head">
      <span class="section-title" style="margin:0">✏️ 我的习惯</span>
      <button class="edit-habits-btn play" @click="openHabits">编辑</button>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top:0">❤️ 喜欢</div>
      <div v-if="memory?.preferences?.length">
        <span v-for="p in memory.preferences" :key="p" class="chip active">{{ p }}</span>
      </div>
      <span v-else class="muted">还没有记录，规划一程后就有了</span>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top:0">🎈 旅行风格</div>
      <div class="hand-note">{{ memory?.travelStyle || '还没填写' }}</div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top:0">💳 预算习惯</div>
      <div class="hand-note">{{ memory?.budgetHabit || '还没填写' }}</div>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top:0">🙅 不太喜欢</div>
      <div v-if="memory?.dislikes?.length">
        <span v-for="d in memory.dislikes" :key="d" class="chip">{{ d }}</span>
      </div>
      <span v-else class="muted">还没有记录</span>
    </div>

    <!-- 打卡弹窗 -->
    <van-popup v-model:show="showCheckin" position="bottom" round>
      <div class="pop">
        <div class="pop-title hand">打卡一个地方</div>
        <p class="muted" style="margin-bottom:12px">记下时间、地点，小游帮你画成地图</p>
        <van-field v-model="cName" placeholder="地点名称，例如：杭州西湖" />
        <div class="date-row">
          <input type="date" v-model="cDate" class="date-input" />
          <input type="time" v-model="cTime" class="date-input" />
        </div>
        <van-field v-model="cNote" placeholder="备注（可选），例如：和谁一起、天气" style="margin-top:8px" />
        <button class="btn-main" style="margin-top:16px" :disabled="savingCheckin" @click="submitCheckin">
          {{ savingCheckin ? '正在保存…' : '保存打卡' }}
        </button>
      </div>
    </van-popup>

    <!-- 习惯编辑弹窗 -->
    <van-popup v-model:show="showHabits" position="bottom" round>
      <div class="pop">
        <div class="pop-title hand">编辑我的习惯</div>
        <p class="muted" style="margin-bottom:12px">多个用「、」隔开，例如：美食、咖啡、博物馆</p>
        <van-field v-model="hPrefs" label="❤️ 喜欢" placeholder="美食、咖啡" />
        <van-field v-model="hDislikes" label="🙅 不喜欢" placeholder="早起、人多" style="margin-top:8px" />
        <van-field v-model="hStyle" label="🎈 风格" placeholder="松弛休闲 / 特种兵…" style="margin-top:8px" />
        <van-field v-model="hBudget" label="💳 预算" placeholder="¥2000-5000" style="margin-top:8px" />
        <button class="btn-main" style="margin-top:16px" :disabled="savingHabits" @click="submitHabits">
          {{ savingHabits ? '正在保存…' : '保存' }}
        </button>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.mine-title { font-size: 30px; letter-spacing: 2px; margin-bottom: 4px; }

.login-card { text-align: center; padding: 24px 18px; }
.login-emoji { font-size: 40px; margin-bottom: 8px; }
.login-title { font-size: 19px; letter-spacing: 1px; color: var(--ink); }

.account-card { padding: 16px; }
.acc-row { display: flex; align-items: center; gap: 12px; }
.acc-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: #F2F6EF; display: flex; align-items: center; justify-content: center;
  font-size: 22px; flex-shrink: 0;
}
.acc-phone { font-size: 17px; letter-spacing: 1px; }
.logout-btn {
  margin-left: auto; background: #f5f1e8; color: #999; border: none;
  border-radius: 999px; padding: 7px 14px; font-size: 13px;
}

.plan-list { display: flex; flex-direction: column; }
.plan-card { position: relative; cursor: pointer; }
.plan-city { font-size: 20px; letter-spacing: 1px; color: var(--ink); margin-bottom: 4px; }
.plan-meta { font-size: 12px; margin-bottom: 8px; }
.plan-arrow { color: var(--olive); font-size: 14px; }

.checkin-map-card { padding: 0; overflow: hidden; }
.checkin-list { display: flex; flex-direction: column; }
.checkin-card { position: relative; cursor: pointer; }
.ck-name { font-size: 16px; letter-spacing: 1px; margin-bottom: 4px; padding-right: 24px; }
.ck-note { margin-top: 6px; }
.ck-del {
  position: absolute; top: 10px; right: 10px;
  width: 22px; height: 22px; border: none; border-radius: 50%;
  background: #f0ede5; color: #aaa; font-size: 12px; line-height: 22px;
  cursor: pointer;
}
.add-checkin-btn {
  display: block; width: 100%; margin: 4px 0 6px; padding: 12px;
  text-align: center; color: var(--olive); background: transparent;
  border: 2px dashed var(--sage); border-radius: 14px;
  font-size: 14px; letter-spacing: 1px;
}

.habits-head { display: flex; align-items: center; justify-content: space-between; margin-top: 22px; }
.edit-habits-btn {
  background: #F2F6EF; color: var(--olive); border: 1.5px solid var(--sage);
  border-radius: 999px; padding: 6px 16px; font-size: 13px;
}

.pop {
  padding: 22px 18px 30px;
  max-height: 80vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.pop-title { font-size: 24px; margin-bottom: 4px; }
.date-row { display: flex; gap: 10px; margin-top: 8px; }
.date-input {
  flex: 1; border: 1.5px solid var(--line); border-radius: 10px;
  padding: 8px 10px; font-size: 14px; background: #fff; color: var(--ink);
}
</style>
