<script setup>
import { ref, computed } from 'vue';
import { showConfirmDialog } from 'vant';
import MapView from './MapView.vue';
import { replan } from '../api.js';

const props = defineProps({ plan: Object });
const emit = defineEmits(['restart', 'update']);

const activeDay = ref(0);
const focusIndex = ref(null);
const replanMsg = ref('');
const replanning = ref(false);
const showAsk = ref(false);
const showAdd = ref(false);
const addName = ref('');
const addNote = ref('');
const showDetail = ref(false);
const detailData = ref({});
const detailLoading = ref(false);

const totalDays = computed(() => props.plan?.days?.length || 0);

// 当前天 + 酒店 的地图标记
const markers = computed(() => {
  const list = [];
  (props.plan?.hotels || []).forEach(h => { if (h.location) list.push({ name: h.name, location: h.location, type: 'hotel' }); });
  const day = props.plan?.days?.[activeDay.value];
  (day?.items || []).forEach(it => { if (it.location) list.push({ name: it.name, location: it.location, type: it.type }); });
  return list;
});

// 顶部天气卡片（取第 1 天）
const day0Weather = computed(() => props.plan?.days?.[0]?.weather || '');
const weatherAlert = computed(() => props.plan?.summary?.weather_alert || '');
const planningNotes = computed(() => props.plan?.summary?.planning_notes || []);

const DAY_EMOJI = ['🌿', '🍵', '🌅', '⛰️', '🌊', '☕', '📷'];

function weatherEmoji(w) {
  if (/雨|雪|雷/.test(w)) return '☔';
  if (/阴/.test(w)) return '☁️';
  if (/晴/.test(w)) return '☀️';
  return '🌤️';
}
function weatherSentence(w) {
  if (/雨|雪|雷/.test(w)) return '今天可能下雨，记得带伞，室内逛逛也不错';
  if (/阴/.test(w)) return '天气有点阴，适合慢慢走走';
  if (/晴|多云/.test(w)) return '今天很适合出门走走';
  return '天气不错，放心出发吧';
}

// 通用：让 AI 基于现有行程 + 一段话重新规划
async function runReplan(message) {
  if (!message || replanning.value) return;
  replanning.value = true;
  try {
    let newPlan = null;
    await replan(props.plan, message, (e) => {
      if (e.type === 'done') newPlan = e.plan;
    });
    if (newPlan) {
      emit('update', newPlan);
      focusIndex.value = null;
    }
  } catch (e) {
    alert('重新规划失败：' + e.message);
  } finally {
    replanning.value = false;
  }
}

// 「问问小游」发送
function sendAsk() {
  const msg = replanMsg.value.trim();
  if (!msg) return;
  runReplan(msg);
  replanMsg.value = '';
  showAsk.value = false;
}

// 天气提醒 → 一键调整
function adjustForWeather() {
  if (!weatherAlert.value) return;
  runReplan(`根据天气提醒调整行程：${weatherAlert.value}`);
}

// 手动添加地点
function openAdd() {
  addName.value = '';
  addNote.value = '';
  showAdd.value = true;
}

function confirmAdd() {
  const name = addName.value.trim();
  if (!name) return;
  const day = props.plan?.days?.[activeDay.value];
  const dayLabel = day?.day || (activeDay.value + 1);
  const note = addNote.value.trim();
  runReplan(`请在第 ${dayLabel} 天的行程中手动加入一个地点「${name}」${note ? `（备注：${note}）` : ''}。请合理安排它当天的时间，并重新计算它与前后地点之间的交通路线，保证当天节奏合理。`);
  showAdd.value = false;
}

// 删除地点 → AI 重排
function removeItem(dayIdx, itemIdx) {
  const day = props.plan?.days?.[dayIdx];
  const it = day?.items?.[itemIdx];
  if (!it) return;
  showConfirmDialog({
    title: '删除这个地点？',
    message: `「${it.name}」将从第 ${day.day} 天移除，小游会重新安排当天行程`,
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  }).then(() => {
    runReplan(`请删除第 ${day.day} 天的「${it.name}」，并重新安排当天剩余地点的时间顺序和交通路线。`);
  }).catch(() => {});
}

// 点击行程项 → 地图定位 + 打开详情弹窗
async function clickItem(idx) {
  focusIndex.value = (props.plan?.hotels || []).length + idx;
  const it = props.plan?.days?.[activeDay.value]?.items?.[idx];
  if (!it) return;
  detailData.value = { name: it.name, address: it.address, note: it.note, type: it.type, transport: it.transport_to_next };
  showDetail.value = true;
  detailLoading.value = true;
  if (it.id) {
    try {
      const r = await fetch(`/api/poi/${encodeURIComponent(it.id)}`);
      const d = await r.json();
      if (!d.error) detailData.value = { ...detailData.value, ...d };
    } catch {}
  }
  detailLoading.value = false;
}
</script>

<template>
  <div class="page" v-if="plan">
    <!-- 顶部总览 -->
    <div class="overview">
      <div class="ov-city hand">{{ plan.city }} · {{ totalDays }}天{{ totalDays - 1 }}晚</div>
      <div class="ov-meta">
        <span>🗓 {{ plan.days?.[0]?.date || '—' }}</span>
        <span>💰 {{ plan.summary?.estimated_cost || '—' }}</span>
      </div>
    </div>

    <!-- 天气卡片 -->
    <div class="weather-card">
      <span class="w-icon">{{ weatherEmoji(day0Weather) }}</span>
      <div class="w-body">
        <div class="w-temp play">{{ day0Weather }}</div>
        <div class="hand-note">{{ weatherSentence(day0Weather) }}</div>
      </div>
    </div>

    <!-- 天气提醒（AI 价值） -->
    <div v-if="weatherAlert" class="alert-card">
      <div class="alert-head">☔ 天气提醒</div>
      <div class="alert-body">{{ weatherAlert }}</div>
      <button class="alert-btn play" @click="adjustForWeather">帮我调整 →</button>
    </div>

    <!-- AI 规划说明 -->
    <div v-if="planningNotes.length" class="notes-card">
      <div class="notes-head play">🧭 小游为什么这么排</div>
      <div v-for="(n, i) in planningNotes" :key="i" class="note-item">{{ n }}</div>
    </div>

    <!-- 地图（与行程联动） -->
    <div class="map-section">
      <div class="map-hint hand-note">👆 点下面的行程，看详情 + 地图带你去</div>
      <MapView :markers="markers" :focus-index="focusIndex" />
    </div>

    <!-- 每日行程 -->
    <van-tabs v-model:active="activeDay" sticky color="#6B7F5E" title-active-color="#6B7F5E">
      <van-tab v-for="(day, i) in plan.days" :key="i" :title="'DAY ' + day.day">
        <div class="day-head">
          <div class="day-theme hand">{{ DAY_EMOJI[i % DAY_EMOJI.length] }} {{ day.theme }}</div>
          <div class="muted">{{ day.weather }}</div>
        </div>
        <div class="timeline">
          <div v-for="(it, j) in day.items" :key="j" class="tl-item anim-item" :style="{ animationDelay: (j * 0.05) + 's' }" @click="clickItem(j)">
            <div class="tl-time play">{{ it.time?.split('-')[0] }}</div>
            <div class="tl-dot" :class="{ meal: it.type === 'meal' }"></div>
            <div class="tl-card" :class="{ meal: it.type === 'meal' }">
              <button class="tl-del" @click.stop="removeItem(i, j)">✕</button>
              <div class="tl-name">{{ it.type === 'meal' ? '🍜' : '📍' }} {{ it.name }}</div>
              <div v-if="it.address" class="muted">{{ it.address }}</div>
              <div v-if="it.note" class="hand-note">{{ it.note }}</div>
              <div v-if="it.transport_to_next" class="tl-transport">↓ {{ it.transport_to_next }}</div>
            </div>
          </div>
        </div>
        <div class="add-btn play" @click="openAdd">＋ 手动添加一个地点</div>
      </van-tab>
    </van-tabs>

    <!-- 酒店推荐 -->
    <div class="section-title">🏨 今晚住这里</div>
    <div class="card hotel-card" v-for="(h, i) in (plan.hotels || [])" :key="i">
      <div class="hotel-name play">{{ h.name }}</div>
      <div class="muted" style="margin:4px 0">{{ h.address }}</div>
      <div v-if="h.rating" class="hotel-rating">⭐ {{ h.rating }}</div>
      <div v-if="h.reason" class="hand-note hotel-reason">「{{ h.reason }}」</div>
    </div>

    <!-- 预算 -->
    <div class="section-title">💰 这一程的预算</div>
    <div class="card">
      <div class="budget-grid">
        <div v-for="(v, k) in plan.summary?.budget || {}" :key="k" class="budget-item">
          <span class="muted">{{ { hotel: '🏨 酒店', food: '🍜 餐饮', transport: '🚕 交通', tickets: '🎫 门票', other: '🧾 其他' }[k] || k }}</span>
          <span class="play">{{ v }}</span>
        </div>
      </div>
      <div class="muted" style="margin-top: 12px">💡 {{ plan.summary?.tips }}</div>
    </div>

    <button class="btn-main" style="margin-top: 8px" @click="emit('restart')">重新规划一程</button>

    <!-- 悬浮 AI 助手 -->
    <button class="ask-fab play" @click="showAsk = true">✨ 问问小游</button>

    <!-- 重新规划中的提示 -->
    <div v-if="replanning" class="replan-banner play">✨ 小游正在调整这一程…</div>

    <!-- AI 对话面板 -->
    <van-popup v-model:show="showAsk" position="bottom" round>
      <div class="ask-panel">
        <div class="ask-title hand">问问小游 ✨</div>
        <p class="muted" style="margin-bottom:10px">旅行中遇到问题？告诉我，小游帮你重新安排</p>
        <van-field
          v-model="replanMsg" type="textarea" rows="2" autosize
          placeholder="比如：今天下雨了怎么办？附近有什么好吃的？"
        />
        <button class="btn-main" style="margin-top:14px" :disabled="replanning" @click="sendAsk">
          {{ replanning ? '正在重新规划…' : '发送' }}
        </button>
      </div>
    </van-popup>

    <!-- 手动添加地点面板 -->
    <van-popup v-model:show="showAdd" position="bottom" round>
      <div class="ask-panel">
        <div class="ask-title hand">手动添加地点</div>
        <p class="muted" style="margin-bottom:10px">添加到 第 {{ plan.days?.[activeDay]?.day }} 天 · 小游会自动调整时间和路线</p>
        <van-field v-model="addName" placeholder="地点名称，例如：雷峰塔" />
        <van-field v-model="addNote" placeholder="备注（可选），例如：想看日落" style="margin-top:8px" />
        <button class="btn-main" style="margin-top:14px" :disabled="replanning" @click="confirmAdd">
          {{ replanning ? '正在调整…' : '添加并让 AI 调整' }}
        </button>
      </div>
    </van-popup>

    <!-- 地点详情弹窗 -->
    <van-popup v-model:show="showDetail" position="bottom" round>
      <div class="ask-panel">
        <div v-if="detailData.photos?.length" class="detail-photo">
          <img :src="detailData.photos[0]" :alt="detailData.name" />
        </div>
        <div class="ask-title hand">{{ detailData.name }}</div>
        <div v-if="detailData.rating" class="detail-rating">⭐ {{ detailData.rating }}</div>
        <div class="detail-meta">
          <div v-if="detailData.cost_yuan" class="muted">💰 人均 ¥{{ detailData.cost_yuan }}</div>
          <div v-if="detailData.open_time" class="muted">🕐 {{ detailData.open_time }}</div>
          <div v-if="detailData.tel" class="muted">📞 {{ detailData.tel }}</div>
          <div v-if="detailData.address" class="muted">📍 {{ detailData.address }}</div>
        </div>
        <div v-if="detailData.note" class="hand-note detail-note">「{{ detailData.note }}」</div>
        <div v-if="detailData.transport" class="muted" style="margin-top:8px">↓ 下一段：{{ detailData.transport }}</div>
        <div v-if="detailLoading" class="muted" style="margin-top:8px">正在加载详情…</div>
      </div>
    </van-popup>
  </div>
</template>

<style scoped>
.overview { padding: 4px 0 6px; }
.ov-city { font-size: 30px; letter-spacing: 2px; }
.ov-meta { display: flex; gap: 16px; margin: 10px 0 14px; color: #777; font-size: 14px; }

.weather-card {
  display: flex; align-items: center; gap: 14px;
  background: linear-gradient(120deg, #EAF2EC, #F4F8F4);
  border-radius: 16px; padding: 16px; margin-bottom: 12px;
}
.w-icon { font-size: 34px; }
.w-temp { font-size: 18px; color: var(--olive); margin-bottom: 4px; }

.alert-card {
  background: #FDF0ED; border: 1px solid #F3D2CC;
  border-radius: 16px; padding: 14px 16px; margin-bottom: 12px;
}
.alert-head { font-family: var(--font-play); color: var(--coral); font-size: 15px; margin-bottom: 6px; }
.alert-body { font-size: 13px; color: #8a5a52; line-height: 1.6; }
.alert-btn {
  margin-top: 10px; background: var(--coral); color: #fff; border: none;
  border-radius: 999px; padding: 8px 16px; font-size: 13px;
}

.notes-card {
  background: #FFFDF4; border: 1px dashed var(--sage);
  border-radius: 16px; padding: 14px 16px; margin-bottom: 12px;
}
.notes-head { color: var(--olive); font-size: 15px; margin-bottom: 8px; letter-spacing: 1px; }
.note-item { font-size: 13px; color: #6a6a6a; line-height: 1.7; padding-left: 16px; position: relative; }
.note-item::before { content: '·'; position: absolute; left: 4px; color: var(--sage); font-weight: bold; }

.map-section { margin-bottom: 14px; }
.map-hint { margin-bottom: 8px; }

.day-head { display: flex; align-items: baseline; justify-content: space-between; padding: 16px 2px 10px; }
.day-theme { font-size: 22px; letter-spacing: 1px; }

.timeline { position: relative; padding-left: 52px; }
.tl-item { position: relative; padding-bottom: 14px; cursor: pointer; }
.tl-time { position: absolute; left: -52px; top: 0; font-size: 14px; color: var(--olive); }
.tl-dot {
  position: absolute; left: -11px; top: 6px;
  width: 11px; height: 11px; border-radius: 50%;
  background: var(--sage); border: 2px solid #fff; box-shadow: 0 0 0 1px var(--sage);
}
.tl-dot.meal { background: var(--yellow); box-shadow: 0 0 0 1px var(--yellow); }
.tl-item:not(:last-child)::before {
  content: ''; position: absolute; left: -7px; top: 22px; bottom: -6px;
  border-left: 2px dashed var(--sage); opacity: .5;
}
.tl-card {
  position: relative;
  background: #fff; border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow);
}
.tl-card.meal { background: #FFFDF4; }
.tl-name { font-weight: 600; margin-bottom: 3px; padding-right: 24px; }
.tl-transport { font-size: 12px; color: var(--olive); margin-top: 6px; }
.tl-del {
  position: absolute; top: 8px; right: 8px;
  width: 22px; height: 22px; border: none; border-radius: 50%;
  background: #f0ede5; color: #aaa; font-size: 12px; line-height: 22px;
  cursor: pointer;
}

.add-btn {
  margin: 4px 0 16px 52px; padding: 12px;
  text-align: center; color: var(--olive);
  border: 2px dashed var(--sage); border-radius: 14px;
  font-size: 14px; letter-spacing: 1px;
}

.hotel-card { position: relative; }
.hotel-name { font-size: 17px; letter-spacing: 1px; }
.hotel-rating { color: var(--orange); font-size: 13px; margin-bottom: 6px; }
.hotel-reason { color: var(--olive); }

.budget-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 10px; }
.budget-item { display: flex; flex-direction: column; gap: 4px; }
.budget-item .play { font-size: 16px; color: var(--olive); }

.ask-fab {
  position: fixed; bottom: 82px; right: max(16px, calc(50vw - 199px));
  z-index: 10; background: var(--olive); color: #fff; border: none;
  border-radius: 999px; padding: 12px 18px; font-size: 15px;
  box-shadow: 0 6px 18px rgba(107,127,94,0.4);
  letter-spacing: 1px;
}
.replan-banner {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
  z-index: 20; background: var(--olive); color: #fff;
  padding: 10px 22px; border-radius: 999px; font-size: 14px;
  box-shadow: 0 6px 18px rgba(107,127,94,0.4);
  animation: bounce 1.4s ease-in-out infinite;
}
.ask-panel {
  padding: 22px 18px 28px;
  max-height: 80vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.ask-title { font-size: 24px; margin-bottom: 4px; }

.detail-photo { text-align: center; margin-bottom: 12px; }
.detail-photo img { max-width: 100%; max-height: 200px; border-radius: 12px; object-fit: cover; }
.detail-rating { color: var(--orange); font-size: 15px; margin: 4px 0 8px; }
.detail-meta .muted { margin-bottom: 4px; font-size: 13px; }
.detail-note { margin-top: 8px; }
</style>
