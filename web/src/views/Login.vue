<script setup>
import { ref, computed } from 'vue';
import { register, login, setToken } from '../auth.js';

const emit = defineEmits(['success', 'back']);

const mode = ref('login'); // 'login' | 'register'
const phone = ref('');
const password = ref('');
const confirm = ref('');
const loading = ref(false);

const title = computed(() => (mode.value === 'login' ? '欢迎回来' : '创建账号'));
const sub = computed(() => (mode.value === 'login' ? '登录后自动保存、同步你的每一程' : '一个手机号，存下你所有的旅行'));
const btnText = computed(() => (loading.value ? '请稍候…' : (mode.value === 'login' ? '登录' : '注册并登录')));

function toggle() {
  mode.value = mode.value === 'login' ? 'register' : 'login';
  confirm.value = '';
  password.value = '';
}

async function submit() {
  const p = phone.value.trim();
  const pw = password.value;
  if (!/^1[3-9]\d{9}$/.test(p)) return alert('请输入正确的 11 位手机号');
  if (pw.length < 6) return alert('密码至少 6 位');
  if (mode.value === 'register' && confirm.value !== pw) return alert('两次输入的密码不一致');
  loading.value = true;
  try {
    const res = mode.value === 'login' ? await login(p, pw) : await register(p, pw);
    setToken(res.token);
    emit('success', { phone: res.phone });
  } catch (e) {
    alert(e.message || '操作失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page login-page">
    <div class="topbar">
      <van-icon name="arrow-left" size="20" @click="emit('back')" />
      <span class="topbar-title play">登录 · 现在就出发</span>
    </div>

    <div class="login-hero">
      <div class="kicker play">这一程，都替你记着</div>
      <h1 class="title hand">{{ title }}</h1>
      <p class="sub muted">{{ sub }}</p>
    </div>

    <div class="card">
      <van-field
        v-model="phone" type="tel" maxlength="11" label-width="0"
        placeholder="手机号"
        clearable
      />
      <div class="dashed"></div>
      <van-field
        v-model="password" type="password" label-width="0"
        placeholder="密码（至少 6 位）"
      />
      <van-field
        v-if="mode === 'register'"
        v-model="confirm" type="password" label-width="0"
        placeholder="再输入一次密码"
        style="margin-top: 4px"
      />
    </div>

    <button class="btn-main" style="margin-top: 22px" :disabled="loading" @click="submit">{{ btnText }}</button>

    <div class="switch muted" @click="toggle">
      {{ mode === 'login' ? '还没有账号？' : '已有账号？' }}<span class="link">点这里{{ mode === 'login' ? '注册' : '登录' }}</span>
    </div>
  </div>
</template>

<style scoped>
.login-page { padding-top: 18px; }
.topbar { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.topbar-title { font-size: 18px; letter-spacing: 2px; }

.login-hero { text-align: center; margin: 22px 0 26px; }
.kicker {
  display: inline-block; font-size: 13px; letter-spacing: 3px;
  color: var(--olive); margin-bottom: 16px;
  padding: 4px 16px; border: 1px dashed var(--sage); border-radius: 999px;
}
.title { font-size: 34px; color: var(--ink); letter-spacing: 3px; margin-bottom: 8px; }
.sub { letter-spacing: 1px; }

.switch { text-align: center; margin-top: 20px; letter-spacing: 1px; }
.link { color: #1989fa; font-weight: 600; }
</style>
