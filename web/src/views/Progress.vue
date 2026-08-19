<script setup>
import { ref, computed, onMounted } from 'vue';
import { streamPlan } from '../api.js';

const props = defineProps({ request: String });
const emit = defineEmits(['done', 'back']);

const STAGES = [
  { key: 'geocode', label: '📍 定位这座城' },
  { key: 'get_weather', label: '☀️ 看看未来几天天气' },
  { key: 'search_pois', label: '🗺️ 找找值得去的地方' },
  { key: 'get_poi_detail', label: '📷 核实好吃好玩的' },
  { key: 'calc_route', label: '🚶 研究它们之间的距离' },
];

const completed = ref([]);
const active = ref(null);
const done = ref(false);
const error = ref('');
const toolCount = ref(0);

// 进度计算：
//   - 阶段完成度最多占 70%（5 个阶段）
//   - 每次工具调用 +2%，最多占 25%（让进度条在反复搜索/算路时持续前进）
//   - 两项相加封顶 95%，最后 5% 留给「生成最终行程」，只有真正完成才到 100%
const percent = computed(() => {
  if (done.value) return 100;
  const stagePart = (completed.value.length / STAGES.length) * 70;
  const toolPart = Math.min(25, toolCount.value * 2);
  return Math.round(Math.min(95, stagePart + toolPart));
});

function statusOf(key) {
  if (done.value) return 'done';
  if (active.value === key) return 'active';
  if (completed.value.includes(key)) return 'done';
  return 'pending';
}

onMounted(async () => {
  try {
    await streamPlan(props.request, (e) => {
      if (e.type === 'tool') {
        toolCount.value++;
        if (!completed.value.includes(e.name)) completed.value.push(e.name);
        active.value = e.name;
      } else if (e.type === 'done') {
        done.value = true;
        completed.value = STAGES.map(s => s.key);
        active.value = null;
        setTimeout(() => emit('done', e.plan), 1300);
      } else if (e.type === 'error') {
        error.value = e.message;
      }
    });
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <div class="page">
    <div class="progress-head">
      <div class="luggage" :class="{ moving: !done && !error }">🧳</div>
      <h2 class="ptitle hand">{{ done ? '准备好了，出发吧' : error ? '哎呀，出了点小状况' : '正在替你规划这一程……' }}</h2>
      <p class="muted">{{ error || '小游正在查天气、找好玩的、算路线' }}</p>
    </div>

    <div class="bar-wrap">
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: percent + '%' }"></div>
      </div>
      <span class="bar-pct play">{{ percent }}%</span>
    </div>

    <div class="steps">
      <div v-for="s in STAGES" :key="s.key" class="step" :class="statusOf(s.key)">
        <van-loading v-if="statusOf(s.key) === 'active'" size="16" color="#6B7F5E" />
        <van-icon v-else :name="statusOf(s.key) === 'done' ? 'checked' : 'clock-o'" :color="statusOf(s.key) === 'done' ? '#6B7F5E' : '#c9c2b4'" />
        <span>{{ s.label }}</span>
      </div>
    </div>

    <button v-if="error" class="btn-main" style="margin-top: 28px" @click="emit('back')">返回重试</button>
  </div>
</template>

<style scoped>
.progress-head { text-align: center; padding: 44px 0 22px; }
.luggage { font-size: 52px; display: inline-block; }
.luggage.moving { animation: bounce 1.6s ease-in-out infinite; }
.ptitle { font-size: 26px; margin: 18px 0 10px; font-weight: 400; letter-spacing: 2px; }

.bar-wrap { display: flex; align-items: center; gap: 12px; margin: 6px 0 22px; }
.bar-track { flex: 1; height: 10px; background: #EDE7DA; border-radius: 999px; overflow: hidden; }
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--sage), var(--olive));
  border-radius: 999px;
  transition: width .5s ease;
}
.bar-pct { font-size: 15px; color: var(--olive); min-width: 44px; text-align: right; }

.steps { margin-top: 4px; }
.step {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: #fff; border-radius: 14px;
  margin-bottom: 10px; font-size: 15px;
  box-shadow: var(--shadow);
  transition: all .3s;
}
.step.pending { color: #c4bfb2; }
.step.active { color: var(--ink); border: 1.5px solid var(--sage); background: #F2F6EF; }
.step.done { color: var(--ink); }
</style>
