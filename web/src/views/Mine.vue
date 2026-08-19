<script setup>
import { ref, onMounted } from 'vue';

const memory = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const r = await fetch('/api/memory');
    memory.value = await r.json();
  } catch {}
  finally { loading.value = false; }
});
</script>

<template>
  <div class="page">
    <div class="mine-title hand">我的旅行手账</div>
    <p class="muted" style="margin-bottom:20px">小游会慢慢记住你的喜好</p>

    <div class="card">
      <div class="section-title">❤️ 喜欢</div>
      <div v-if="memory?.preferences?.length">
        <span v-for="p in memory.preferences" :key="p" class="chip active">{{ p }}</span>
      </div>
      <span v-else class="muted">还没有记录，规划一程后就有了</span>
    </div>

    <div class="card">
      <div class="section-title">🎈 旅行风格</div>
      <div class="hand-note">{{ memory?.travelStyle || '还没填写' }}</div>
    </div>

    <div class="card">
      <div class="section-title">💳 预算习惯</div>
      <div class="hand-note">{{ memory?.budgetHabit || '还没填写' }}</div>
    </div>

    <div class="card">
      <div class="section-title">🙅 不太喜欢</div>
      <div v-if="memory?.dislikes?.length">
        <span v-for="d in memory.dislikes" :key="d" class="chip">{{ d }}</span>
      </div>
      <span v-else class="muted">还没有记录</span>
    </div>
  </div>
</template>

<style scoped>
.mine-title { font-size: 30px; letter-spacing: 2px; margin-bottom: 4px; }
</style>
