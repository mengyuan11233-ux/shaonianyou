<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { loadAMap } from '../map.js';

const props = defineProps({
  markers: { type: Array, default: () => [] },  // [{ name, location:"lng,lat", type }]
  focusIndex: { type: Number, default: null },
  height: { type: String, default: '40vh' },
});

const container = ref(null);
const loadError = ref('');
let AMap = null;
let map = null;
let infoWindow = null;
let amapMarkers = [];

onMounted(async () => {
  try {
    AMap = await loadAMap();
    // 初始中心：有标记点就用第一个点的位置，否则默认北京
    const first = props.markers?.[0]?.location;
    const center = first ? first.split(',').map(Number) : [116.397, 39.908];
    map = new AMap.Map(container.value, { zoom: 12, center });
    infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -30) });
    renderMarkers();
  } catch (e) {
    loadError.value = e.message;
  }
});

onBeforeUnmount(() => { if (map) map.destroy(); });

watch(() => props.markers, () => renderMarkers(), { deep: true });

watch(() => props.focusIndex, (i) => {
  if (i == null || !map || !props.markers?.[i]) return;
  const m = props.markers[i];
  const pos = m.location.split(',').map(Number);
  map.setZoomAndCenter(15, pos);
  infoWindow.setContent(`<b>${m.name}</b>`);
  infoWindow.open(map, pos);
});

function renderMarkers() {
  if (!map || !AMap) return;
  amapMarkers.forEach(m => map.remove(m));
  amapMarkers = (props.markers || []).map(m => {
    const pos = m.location.split(',').map(Number);
    const marker = new AMap.Marker({ position: pos, title: m.name });
    marker.on('click', () => {
      infoWindow.setContent(`<b>${m.name}</b>`);
      infoWindow.open(map, pos);
    });
    marker.setMap(map);
    return marker;
  });
  if (amapMarkers.length) map.setFitView(amapMarkers);
}
</script>

<template>
  <div class="map-wrap">
    <div v-if="loadError" class="map-error">⚠️ {{ loadError }}</div>
    <div ref="container" class="map-container" :style="{ height }"></div>
  </div>
</template>

<style scoped>
.map-wrap { position: relative; }
.map-container { width: 100%; border-radius: 14px; overflow: hidden; }
.map-error {
  position: absolute; inset: 0; z-index: 2;
  display: flex; align-items: center; justify-content: center;
  background: #FDF0ED; color: #8a5a52; font-size: 13px; text-align: center; padding: 20px;
  border-radius: 14px;
}
</style>
