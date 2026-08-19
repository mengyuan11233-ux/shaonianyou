<script setup>
import { ref, computed } from 'vue';
import Home from './views/Home.vue';
import Form from './views/Form.vue';
import Progress from './views/Progress.vue';
import Itinerary from './views/Itinerary.vue';
import MapPage from './views/MapPage.vue';
import Mine from './views/Mine.vue';

const view = ref('home');
const request = ref('');
const plan = ref(null);
const activeTab = ref('home');

// 规划完成后，才在 首页/行程/地图/我的 之间显示底部导航
const showNav = computed(() => plan.value != null && ['home', 'itinerary', 'map', 'mine'].includes(view.value));

function onExplore() { view.value = 'form'; }
function onSubmit(req) { request.value = req; view.value = 'progress'; }
function onDone(p) { plan.value = p; activeTab.value = 'itinerary'; view.value = 'itinerary'; }
function onResume() { activeTab.value = 'itinerary'; view.value = 'itinerary'; }
function onTabChange(name) { activeTab.value = name; view.value = name; }
</script>

<template>
  <transition name="fade" mode="out-in">
    <Home v-if="view === 'home'" key="home" :plan="plan" @explore="onExplore" @resume="onResume" />
    <Form v-else-if="view === 'form'" key="form" @submit="onSubmit" @back="view = 'home'" />
    <Progress v-else-if="view === 'progress'" key="progress" :request="request" @done="onDone" @back="view = 'form'" />
    <Itinerary v-else-if="view === 'itinerary'" key="itinerary" :plan="plan" @restart="onTabChange('home')" @update="plan = $event" />
    <MapPage v-else-if="view === 'map'" key="map" :plan="plan" />
    <Mine v-else key="mine" />
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
