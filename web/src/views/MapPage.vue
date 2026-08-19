<script setup>
import { computed } from 'vue';
import MapView from './MapView.vue';

const props = defineProps({ plan: Object });

// 全部地点（酒店 + 所有天的行程）
const markers = computed(() => {
  const list = [];
  (props.plan?.hotels || []).forEach(h => { if (h.location) list.push({ name: h.name, location: h.location, type: 'hotel' }); });
  (props.plan?.days || []).forEach(d => {
    (d.items || []).forEach(it => { if (it.location) list.push({ name: it.name, location: it.location, type: it.type }); });
  });
  return list;
});
</script>

<template>
  <div class="mappage">
    <div class="mappage-head">
      <div class="title hand">{{ plan?.city || '这一程' }} · 路线</div>
      <div class="muted">{{ markers.length }} 个地点</div>
    </div>
    <div class="map-box">
      <MapView v-if="plan" :markers="markers" height="calc(100vh - 150px)" />
      <div v-else class="empty muted">先去规划一程，这里就有路线啦</div>
    </div>
  </div>
</template>

<style scoped>
.mappage { padding: 20px 14px 80px; max-width: 430px; margin: 0 auto; }
.mappage-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; }
.title { font-size: 25px; letter-spacing: 1px; }
.map-box { border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); }
.empty { padding: 60px 20px; text-align: center; background: #fff; border-radius: 16px; }
</style>
