<script setup>
import { ref, computed, onMounted } from 'vue';
import Home from './views/Home.vue';
import Form from './views/Form.vue';
import Progress from './views/Progress.vue';
import Itinerary from './views/Itinerary.vue';
import MapPage from './views/MapPage.vue';
import Mine from './views/Mine.vue';
import Login from './views/Login.vue';
import { getToken, fetchMe, logout as apiLogout } from './auth.js';

const view = ref('home');
const request = ref('');
const plan = ref(null);
const activeTab = ref('home');
const user = ref(null);      // { phone } 或 null
const plans = ref([]);       // 历史行程列表

// 底部导航在 首页/行程/地图/我的 之间显示（无行程也能进「我的」登录）
const showNav = computed(() => ['home', 'itinerary', 'map', 'mine'].includes(view.value));

async function refreshPlans() {
  const me = await fetchMe();
  if (me && me.phone) { user.value = { phone: me.phone }; plans.value = me.plans || []; }
}

// 启动时恢复登录态（有 token 则拉取用户 + 历史行程）
onMounted(() => {
  if (getToken()) refreshPlans();
});

function onExplore() { view.value = 'form'; }
function onSubmit(req) { request.value = req; view.value = 'progress'; }
function onDone(p) {
  plan.value = p;
  activeTab.value = 'itinerary'; view.value = 'itinerary';
  if (user.value) refreshPlans();   // 已登录 → 刷新历史列表
}
function onUpdate(p) {
  plan.value = p;
  if (user.value) refreshPlans();
}
function onResume() { activeTab.value = 'itinerary'; view.value = 'itinerary'; }
function onTabChange(name) {
  // 没有行程时，行程/地图两个标签没有内容，回首页
  if (!plan.value && (name === 'itinerary' || name === 'map')) {
    activeTab.value = 'home'; view.value = 'home';
    return;
  }
  activeTab.value = name; view.value = name;
}

function onLoginSuccess(payload) {
  user.value = { phone: payload.phone };
  refreshPlans();
  activeTab.value = 'mine'; view.value = 'mine';
}
function onLogout() {
  apiLogout();
  user.value = null;
  plans.value = [];
}
function onOpenPlan(p) {
  plan.value = p.plan || p;
  activeTab.value = 'itinerary'; view.value = 'itinerary';
}
</script>

<template>
  <transition name="fade" mode="out-in">
    <Home v-if="view === 'home'" key="home" :plan="plan" :user="user" @explore="onExplore" @resume="onResume" @login="view = 'login'" @mine="onTabChange('mine')" />
    <Form v-else-if="view === 'form'" key="form" @submit="onSubmit" @back="view = 'home'" />
    <Progress v-else-if="view === 'progress'" key="progress" :request="request" @done="onDone" @back="view = 'form'" />
    <Itinerary v-else-if="view === 'itinerary'" key="itinerary" :plan="plan" @restart="onTabChange('home')" @update="onUpdate" />
    <MapPage v-else-if="view === 'map'" key="map" :plan="plan" />
    <Login v-else-if="view === 'login'" key="login" @success="onLoginSuccess" @back="onTabChange('mine')" />
    <Mine v-else key="mine" :user="user" :plans="plans" @login="view = 'login'" @logout="onLogout" @open-plan="onOpenPlan" />
  </transition>

  <van-tabbar
    v-if="showNav"
    v-model="activeTab"
    active-color="#6B7F5E"
    inactive-color="#9B9B9B"
    fixed
    safe-area-inset-bottom
    @change="onTabChange"
  >
    <van-tabbar-item name="home" icon="home-o">首页</van-tabbar-item>
    <van-tabbar-item name="itinerary" icon="orders-o">行程</van-tabbar-item>
    <van-tabbar-item name="map" icon="location-o">地图</van-tabbar-item>
    <van-tabbar-item name="mine" icon="user-o">我的</van-tabbar-item>
  </van-tabbar>
</template>
