// ============================================================
// 少年游 · 高德地图工具集 + 工具注册表
// 每个工具统一返回：成功 → 纯数据；失败 → { error: '可操作提示' }
// ============================================================

import 'dotenv/config';

const AMAP_KEY = process.env.AMAP_WEB_SERVICE_KEY;
const BASE = 'https://restapi.amap.com';

// ---------- 通用请求（超时 + 重试） ----------
async function fetchJSON(url, { timeout = 8000, retries = 1 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`   ⏳ 请求失败（${err.message}），第 ${attempt + 1} 次重试...`);
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------- 1. 地理编码 ----------
export async function geocode(address) {
  try {
    const url = `${BASE}/v3/geocode/geo?address=${encodeURIComponent(address)}&key=${AMAP_KEY}`;
    const res = await fetchJSON(url);
    if (res.status !== '1' || !res.geocodes?.length) return { error: `地理编码失败：${address}` };
    const g = res.geocodes[0];
    return { name: g.formatted_address, location: g.location, adcode: g.adcode, city: g.city?.length ? g.city : g.province };
  } catch (err) {
    return { error: `地理编码请求异常：${err.message}` };
  }
}

// ---------- 2. 天气（未来4天） ----------
export async function getWeather(adcode) {
  try {
    const url = `${BASE}/v3/weather/weatherInfo?city=${adcode}&key=${AMAP_KEY}&extensions=all`;
    const res = await fetchJSON(url);
    if (res.status !== '1') return { error: `天气查询失败（adcode: ${adcode}）` };
    const WEEK = {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'};
    return (res.forecasts?.[0]?.casts ?? []).map(c => ({
      date: c.date,
      week: WEEK[c.week] || c.week,
      weather: c.dayweather === c.nightweather ? c.dayweather : `${c.dayweather}转${c.nightweather}`,
      temp: `${c.nighttemp}~${c.daytemp}℃`,
      daypower: c.daypower || '',
    }));
  } catch (err) {
    return { error: `天气请求异常：${err.message}` };
  }
}

// ---------- 3. POI 搜索 ----------
export async function searchPois({ keywords, city, types, offset = 5 }) {
  try {
    const params = new URLSearchParams({ key: AMAP_KEY, keywords, city, citylimit: 'true', offset: String(offset) });
    if (types) params.set('types', types);
    const res = await fetchJSON(`${BASE}/v3/place/text?${params}`);
    if (res.status !== '1') return { error: `POI 搜索失败：${keywords}` };
    // 只保留规划/地图所需的精简字段，控制上下文大小
    const pois = (res.pois ?? []).filter(p => p.location?.length).map(p => ({
      id: p.id, name: p.name, type: p.type, address: p.address, location: p.location,
    }));
    if (!pois.length) return { error: `未搜到「${keywords}」相关地点，请更换关键词或城市重试` };
    return pois;
  } catch (err) {
    return { error: `POI 请求异常：${err.message}` };
  }
}

// ---------- 4. POI 详情（照片/评分/人均/营业时间） ----------
export async function getPoiDetail(id) {
  try {
    const res = await fetchJSON(`${BASE}/v3/place/detail?key=${AMAP_KEY}&id=${encodeURIComponent(id)}`);
    if (res.status !== '1') return { error: `POI 详情获取失败（id: ${id}）` };
    const p = res.pois?.[0];
    if (!p) return { error: `未找到 POI 详情（id: ${id}）` };
    const biz = p.biz_ext || {};
    const norm = v => (Array.isArray(v) ? (v.join('') || '') : (v || ''));
    return {
      id: p.id, name: p.name, type: p.type, address: p.address, location: p.location,
      tel: p.tel || '',
      photos: (p.photos || []).slice(0, 3).map(ph => ph.url),
      rating: norm(biz.rating), cost_yuan: norm(biz.cost), open_time: norm(biz.open_time),
    };
  } catch (err) {
    return { error: `POI 详情请求异常：${err.message}` };
  }
}

// ---------- 5. 路线规划（公交/步行/驾车） ----------
// 高德路线接口要求坐标；这里把地名或坐标统一解析为 "lng,lat"
async function resolveToCoord(input, city) {
  const s = String(input || '').trim();
  if (/^-?\d+\.\d+,-?\d+\.\d+$/.test(s)) return s;
  const query = city && !s.includes(city) ? `${city}${s}` : s;
  const g = await geocode(query);
  if (g.error || !g.location) throw new Error(g.error || `无法解析地点坐标：${s}`);
  return g.location;
}

export async function calcRoute({ origin, destination, city, mode = 'transit' }) {
  try {
    const originLoc = await resolveToCoord(origin, city);
    const destinationLoc = await resolveToCoord(destination, city);
    let url;
    if (mode === 'transit') {
      url = `${BASE}/v3/direction/transit/integrated?origin=${originLoc}&destination=${destinationLoc}&city=${encodeURIComponent(city)}&cityd=${encodeURIComponent(city)}&key=${AMAP_KEY}`;
    } else {
      url = `${BASE}/v3/direction/${mode}?origin=${originLoc}&destination=${destinationLoc}&key=${AMAP_KEY}`;
    }
    const res = await fetchJSON(url);
    if (res.status !== '1') return { error: `路径规划失败（${origin} → ${destination}）` };
    if (mode === 'transit') {
      const t = res.route?.transits?.[0];
      if (!t) return { error: `无公共交通方案（${origin} → ${destination}），改用 walking 或 driving 重新计算` };
      return { mode, duration_minutes: Math.round(Number(t.duration) / 60), distance_km: +(Number(t.distance) / 1000).toFixed(1), cost_yuan: t.cost || '0' };
    }
    const p = res.route?.paths?.[0];
    if (!p) return { error: `无${mode}路线（${origin} → ${destination}）` };
    return { mode, duration_minutes: Math.round(Number(p.duration) / 60), distance_km: +(Number(p.distance) / 1000).toFixed(1) };
  } catch (err) {
    return { error: `路径规划请求异常：${err.message}` };
  }
}

// ---------- 工具注册表（给 LLM 的 function schema） ----------
export const TOOL_SCHEMAS = [
  { type: 'function', function: { name: 'geocode', description: '将地名/城市名转换为经纬度和城市编码（adcode）。规划前必须先调用。',
    parameters: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] } } },
  { type: 'function', function: { name: 'get_weather', description: '查询城市未来4天天气预报（天气、温度、风力）。',
    parameters: { type: 'object', properties: { adcode: { type: 'string' } }, required: ['adcode'] } } },
  { type: 'function', function: { name: 'search_pois', description: '搜索 POI（景点/餐厅/酒店/咖啡厅等）。所有地点必须来自本工具，严禁编造。types 可选：110000=风景名胜, 050000=餐饮, 100000=住宿服务, 060100=商场, 080300=博物馆, 050500=咖啡厅。',
    parameters: { type: 'object', properties: { keywords: { type: 'string' }, city: { type: 'string' }, types: { type: 'string' }, offset: { type: 'number' } }, required: ['keywords', 'city'] } } },
  { type: 'function', function: { name: 'get_poi_detail', description: '获取单个 POI 的真实详情（照片、评分、人均、营业时间）。计划采用的餐厅/酒店应调用本工具核实。',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } } },
  { type: 'function', function: { name: 'calc_route', description: '计算两点间路线耗时与距离。mode=transit(公交)/walking(步行)/driving(驾车)。近距离用 walking，跨区用 transit。',
    parameters: { type: 'object', properties: { origin: { type: 'string' }, destination: { type: 'string' }, city: { type: 'string' }, mode: { type: 'string', enum: ['transit', 'walking', 'driving'] } }, required: ['origin', 'destination', 'city'] } } },
];

// ---------- 统一分发 ----------
export async function dispatchTool(name, args) {
  switch (name) {
    case 'geocode': return geocode(args.address);
    case 'get_weather': return getWeather(args.adcode);
    case 'search_pois': return searchPois(args);
    case 'get_poi_detail': return getPoiDetail(args.id);
    case 'calc_route': return calcRoute(args);
    default: return { error: `未知工具：${name}` };
  }
}
