<script setup>
const props = defineProps({ plan: Object });
const emit = defineEmits(['explore', 'resume']);
</script>

<template>
  <div class="home">
    <div class="stickers">
      <span class="sticker s1">✈️</span>
      <span class="sticker s2">🏔️</span>
      <span class="sticker s3">📷</span>
      <span class="sticker s4">🧳</span>
    </div>

    <div class="hero">
      <p class="kicker play">现在就出发</p>
      <h1 class="poem hand">欲买桂花同载酒</h1>
      <h1 class="poem hand">终不似，少年游</h1>
      <p class="sub play">这一程，去看看吧。</p>
    </div>

    <!-- 已有行程时显示继续查看入口 -->
    <div v-if="plan" class="current-trip" @click="emit('resume')">
      <div class="ct-info">
        <div class="ct-city hand">{{ plan.city }} · {{ plan.days.length }}天</div>
        <div class="ct-meta muted">{{ plan.days[0]?.date }} · {{ plan.summary?.estimated_cost || '' }}</div>
      </div>
      <span class="ct-arrow play">查看行程 →</span>
    </div>

    <div class="hero-actions">
      <button class="btn-sticker" @click="emit('explore')">{{ plan ? '再规划一程 →' : '开始探索 →' }}</button>
      <p class="hint muted">AI 帮你把一场旅行真正规划出来</p>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  max-width: 430px; margin: 0 auto;
  position: relative;
  display: flex; flex-direction: column; justify-content: center;
  padding: 40px 28px;
  overflow: hidden;
  background:
    radial-gradient(90% 50% at 15% 12%, rgba(242,215,124,0.30), transparent 60%),
    radial-gradient(80% 45% at 90% 20%, rgba(168,203,224,0.32), transparent 60%),
    radial-gradient(70% 40% at 50% 90%, rgba(143,169,143,0.22), transparent 60%),
    var(--bg);
}
.stickers { position: absolute; inset: 0; pointer-events: none; }
.sticker {
  position: absolute; font-size: 34px;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.10));
  opacity: .9;
}
.s1 { top: 12%; left: 12%; transform: rotate(-12deg); }
.s2 { top: 22%; right: 14%; transform: rotate(10deg); }
.s3 { bottom: 26%; left: 10%; transform: rotate(8deg); }
.s4 { bottom: 14%; right: 12%; transform: rotate(-10deg); }

.hero { text-align: center; position: relative; z-index: 1; }
.kicker {
  display: inline-block; font-size: 15px; letter-spacing: 6px;
  color: var(--olive); margin-bottom: 34px;
  padding: 5px 18px; border: 1px dashed var(--sage); border-radius: 999px;
}
.poem {
  font-weight: 400; font-size: 34px; line-height: 1.55;
  color: var(--ink); letter-spacing: 4px;
}
.sub { margin-top: 22px; color: #7a7a7a; letter-spacing: 5px; font-size: 15px; }

.current-trip {
  position: relative; z-index: 1;
  margin: 36px auto 0; max-width: 320px;
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-radius: 16px; padding: 16px 20px;
  box-shadow: var(--shadow); cursor: pointer;
  border: 2px solid var(--sage);
  transition: transform .15s;
}
.current-trip:active { transform: scale(0.97); }
.ct-city { font-size: 20px; color: var(--ink); letter-spacing: 1px; }
.ct-meta { font-size: 13px; margin-top: 4px; }
.ct-arrow { color: var(--olive); font-size: 14px; white-space: nowrap; }

.hero-actions { text-align: center; margin-top: 30px; position: relative; z-index: 1; }
.hint { margin-top: 22px; letter-spacing: 1px; }
</style>
