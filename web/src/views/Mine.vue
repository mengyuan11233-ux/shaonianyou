<script setup>
import { ref, onMounted } from 'vue';
import { authHeaders } from '../auth.js';

const props = defineProps({ user: Object, plans: Array });
const emit = defineEmits(['login', 'logout', 'open-plan']);

const memory = ref(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const r = await fetch('/api/memory', { headers: authHeaders() });
    memory.value = await r.json();
  } catch {}
  finally { loading.value = false; }
});

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
      <p class="muted" style="margin:6px 0 14px">换手机、刷新页面都不怕丢，随时回来看</p>
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
        <div
          v-for="p in plans" :key="p.id"
          class="card plan-card"
          @click="emit('open-plan', p)"
        >
          <div class="plan-city play">{{ p.city }}</div>
          <div class="plan-meta muted">{{ p.days }}天{{ (p.days || 1) - 1 }}晚 · {{ p.date }} · 保存于 {{ fmtDate(p.savedAt) }}</div>
          <span class="plan-arrow play">查看行程 →</span>
        </div>
      </div>
      <div v-else class="card muted">还没有保存的行程，规划一程后会自动出现在这里</div>
    </template>

    <!-- 偏好记忆 -->
    <div class="card" style="margin-top:16px">
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

.plan-list { display: flex; flex-direction: column; gap: 0; }
.plan-card { position: relative; cursor: pointer; }
.plan-city { font-size: 20px; letter-spacing: 1px; color: var(--ink); margin-bottom: 4px; }
.plan-meta { font-size: 12px; margin-bottom: 8px; }
.plan-arrow { color: var(--olive); font-size: 14px; }
</style>
