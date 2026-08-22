<script setup>
import { ref, computed } from 'vue';
import { authHeaders } from '../auth.js';

const emit = defineEmits(['submit', 'back']);

const dest = ref('');
const start = ref('');
const end = ref('');
const people = ref(2);
const relation = ref('朋友');
const budget = ref('¥2000-5000');
const prefs = ref([]);
const nl = ref('');

const RELATIONS = [
  { value: '独自旅行', icon: '👤', label: '一个人' },
  { value: '情侣', icon: '👫', label: '情侣' },
  { value: '朋友', icon: '👯', label: '朋友' },
  { value: '家人', icon: '👨‍👩‍👧', label: '家人' },
];

const BUDGETS = ['¥1000以内', '¥1000-2000', '¥2000-5000', '¥5000以上'];

const PREF_ITEMS = [
  { value: '美食', icon: '🍜', label: '吃很多好吃的' },
  { value: '自然风景', icon: '🌿', label: '看自然风景' },
  { value: '人文历史', icon: '🏛️', label: '感受当地文化' },
  { value: '拍照打卡', icon: '📷', label: '拍很多照片' },
  { value: '咖啡', icon: '☕', label: '找咖啡馆发呆' },
  { value: '夜生活', icon: '🌙', label: '夜晚也精彩' },
  { value: '购物', icon: '🛍️', label: '逛逛买买' },
  { value: '博物馆', icon: '🏛️', label: '逛博物馆' },
  { value: '小众景点', icon: '📍', label: '去小众地方' },
  { value: '松弛休闲', icon: '🛋️', label: '慢慢放松' },
  { value: '特种兵', icon: '🏃', label: '一次玩够' },
];

// 本地「今天」日期（YYYY-MM-DD，按本地时区算，避免 UTC 跨天）
const today = computed(() => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
});
const endMin = computed(() => start.value || today.value);

function togglePref(p) {
  const i = prefs.value.indexOf(p);
  if (i >= 0) prefs.value.splice(i, 1);
  else prefs.value.push(p);
}

function days() {
  if (!start.value || !end.value) return 0;
  return Math.round((new Date(end.value) - new Date(start.value)) / 86400000) + 1;
}

async function submit() {
  if (!dest.value) return alert('请先输入目的地');
  if (start.value && end.value && new Date(end.value) < new Date(start.value)) {
    return alert('结束日期不能早于开始日期');
  }
  const d = days() || 3;
  const req = [
    `帮我规划一个${dest.value}${d}日游。`,
    `日期：${start.value || '待定'} 至 ${end.value || '待定'}`,
    `人数：${people.value}人，${relation.value}`,
    `预算：${budget.value}`,
    `偏好：${prefs.value.join('、') || '无特别偏好'}`,
    `额外需求：${nl.value || '无'}`,
  ].join('\n');

  // 保存用户偏好到记忆（静默，失败不阻塞规划）
  try {
    await fetch('/api/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        preferences: prefs.value,
        budgetHabit: budget.value,
        travelStyle: prefs.value.includes('特种兵') ? '特种兵' : prefs.value.includes('松弛休闲') ? '松弛休闲' : '',
      }),
    });
  } catch {}

  emit('submit', req);
}
</script>

<template>
  <div class="page">
    <div class="topbar">
      <van-icon name="arrow-left" size="20" @click="emit('back')" />
      <span class="topbar-title play">规划这一程</span>
    </div>

    <div class="q hand">这一次，你想去哪里？</div>
    <div class="card">
      <van-field v-model="dest" placeholder="例如：杭州 / 成都 / 西安" label-width="0" />
    </div>

    <div class="q hand">准备玩几天？</div>
    <div class="card row">
      <input type="date" v-model="start" :min="today" class="date-input" />
      <span class="muted">至</span>
      <input type="date" v-model="end" :min="endMin" class="date-input" />
      <span class="days play" v-if="days()">{{ days() }} 天</span>
    </div>

    <div class="q hand">几个人去？</div>
    <div class="card row">
      <van-stepper v-model="people" min="1" max="10" theme="round" button-size="26" />
      <span class="muted" style="margin-left:10px">{{ people }} 人</span>
    </div>

    <div class="q hand">和谁一起？</div>
    <div class="rel-grid">
      <div
        v-for="r in RELATIONS" :key="r.value"
        class="rel-card" :class="{ active: relation === r.value }"
        @click="relation = r.value"
      >
        <span class="rel-icon">{{ r.icon }}</span>
        <span class="rel-label play">{{ r.label }}</span>
      </div>
    </div>

    <div class="q hand">预算大概多少？</div>
    <div class="card">
      <span
        v-for="b in BUDGETS" :key="b"
        class="chip" :class="{ active: budget === b }"
        @click="budget = b"
      >{{ b }}</span>
    </div>

    <div class="q hand">这次最想要什么？</div>
    <div class="card">
      <span
        v-for="p in PREF_ITEMS" :key="p.value"
        class="chip pref-chip" :class="{ active: prefs.includes(p.value) }"
        @click="togglePref(p.value)"
      >{{ p.icon }} {{ p.label }}</span>
    </div>

    <div class="q hand">还有什么想说？</div>
    <div class="card note-card">
      <van-field
        v-model="nl"
        type="textarea" rows="2" autosize
        placeholder="例如：不想早起，喜欢拍照和吃，不想去人特别多的地方"
      />
    </div>

    <button class="btn-main" style="margin-top: 28px" @click="submit">开始规划 ✨</button>
  </div>
</template>

<style scoped>
.topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.topbar-title { font-size: 18px; letter-spacing: 2px; }
.q { font-size: 22px; color: var(--ink); margin: 26px 0 12px; letter-spacing: 1px; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.date-input {
  border: 1.5px solid var(--line); border-radius: 10px;
  padding: 8px 10px; font-size: 14px; background: #fff; color: var(--ink);
}
.days { margin-left: auto; color: var(--olive); font-size: 16px; }

.rel-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.rel-card {
  background: #fff; border-radius: 14px; padding: 16px 6px;
  text-align: center; box-shadow: var(--shadow);
  border: 2px solid transparent; transition: all .15s;
}
.rel-icon { font-size: 30px; display: block; margin-bottom: 6px; }
.rel-label { font-size: 13px; color: #777; }
.rel-card.active { border-color: var(--sage); background: #F2F6EF; }
.rel-card.active .rel-label { color: var(--olive); }

.pref-chip { padding: 10px 14px; font-size: 14px; }
.note-card { background: linear-gradient(180deg, #FFFDF4, #FFFFFF); border: 1px dashed var(--line); }
</style>
