// ============================================================
// 少年游 · 技术验证脚本 v2（增加输出解析 + 规则校验）
// ============================================================

import 'dotenv/config';
import OpenAI from 'openai';

const AMAP_KEY = process.env.AMAP_WEB_SERVICE_KEY;
const LLM_KEY = process.env.LLM_API_KEY;
const LLM_URL = process.env.LLM_BASE_URL;
const LLM_MODEL = process.env.LLM_MODEL;

if (!AMAP_KEY || !LLM_KEY) {
  console.error('❌ 缺少 API Key！请检查 .env 文件');
  process.exit(1);
}

const llm = new OpenAI({ apiKey: LLM_KEY, baseURL: LLM_URL });

// ---------- 通用请求工具（超时 + 重试） ----------
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

// ---------- 高德工具函数 ----------
async function amapGeocode(address) {
  try {
    const url = `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}&key=${AMAP_KEY}`;
    const res = await fetchJSON(url);
    if (res.status !== '1' || !res.geocodes?.length) return { error: `地理编码失败：${address}` };
    const g = res.geocodes[0];
    return { name: g.formatted_address, location: g.location, adcode: g.adcode, city: g.city?.length ? g.city : g.province };
  } catch (err) {
    return { error: `地理编码请求异常：${err.message}` };
  }
}

async function amapWeather(adcode) {
  try {
    const url = `https://restapi.amap.com/v3/weather/weatherInfo?city=${adcode}&key=${AMAP_KEY}&extensions=all`;
    const res = await fetchJSON(url);
    if (res.status !== '1') return { error: `天气查询失败（adcode: ${adcode}）` };
    const WEEK = {1:'周一',2:'周二',3:'周三',4:'周四',5:'周五',6:'周六',7:'周日'};
    return (res.forecasts?.[0]?.casts ?? []).map(c => ({
      date: c.date,
      week: WEEK[c.week] || c.week,
      weather: c.dayweather === c.nightweather ? c.dayweather : `${c.dayweather}转${c.nightweather}`,
      temp: `${c.nighttemp}~${c.daytemp}℃`,
    }));
  } catch (err) {
    return { error: `天气请求异常：${err.message}` };
  }
}

async function amapSearchPOI({ keywords, city, types, offset = 10 }) {
  try {
    const params = new URLSearchParams({ key: AMAP_KEY, keywords, city, citylimit: 'true', offset: String(offset) });
    if (types) params.set('types', types);
    const res = await fetchJSON(`https://restapi.amap.com/v3/place/text?${params}`);
    if (res.status !== '1') return { error: `POI 搜索失败：${keywords}` };
    const pois = (res.pois ?? []).filter(p => p.location && p.location.length).map(p => ({
      name: p.name, type: p.type, address: p.address, location: p.location,
    }));
    if (!pois.length) return { error: `未搜到「${keywords}」相关地点，请更换关键词或城市重试` };
    return pois;
  } catch (err) {
    return { error: `POI 请求异常：${err.message}` };
  }
}

async function amapTransit({ origin, destination, city }) {
  try {
    const url = `https://restapi.amap.com/v3/direction/transit/integrated?origin=${origin}&destination=${destination}&city=${encodeURIComponent(city)}&cityd=${encodeURIComponent(city)}&key=${AMAP_KEY}`;
    const res = await fetchJSON(url);
    if (res.status !== '1') return { error: `路径规划失败：${origin} → ${destination}` };
    const t = res.route?.transits?.[0];
    if (!t) return { error: `两点距离太近或太远，无公共交通方案（${origin} → ${destination}），可考虑步行或打车` };
    return { duration_minutes: Math.round(Number(t.duration) / 60), distance_km: (Number(t.distance) / 1000).toFixed(1), cost_yuan: t.cost || '0' };
  } catch (err) {
    return { error: `路径规划请求异常：${err.message}` };
  }
}

// ---------- 工具定义 ----------
const tools = [
  { type: 'function', function: { name: 'geocode', description: '将地名/城市名转换为经纬度和城市编码。必须最先调用。',
    parameters: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] } } },
  { type: 'function', function: { name: 'get_weather', description: '查询城市未来4天天气预报。',
    parameters: { type: 'object', properties: { adcode: { type: 'string' } }, required: ['adcode'] } } },
  { type: 'function', function: { name: 'search_pois', description: '搜索 POI（景点、餐厅等）。所有地点必须来自本工具，严禁编造。',
    parameters: { type: 'object', properties: {
      keywords: { type: 'string' }, city: { type: 'string' },
      types: { type: 'string', description: '110000=风景名胜, 050000=餐饮' },
      offset: { type: 'number' },
    }, required: ['keywords', 'city'] } } },
  { type: 'function', function: { name: 'calc_transit', description: '计算两点间公共交通耗时。',
    parameters: { type: 'object', properties: {
      origin: { type: 'string' }, destination: { type: 'string' }, city: { type: 'string' },
    }, required: ['origin', 'destination', 'city'] } } },
];

const SYSTEM_PROMPT = `你是「少年游」的资深行程规划师，擅长设计"不走回头路、节奏合理、吃得地道"的旅行路线。

工作规则（严格遵守）：
1. 先调用 geocode 获取坐标和 adcode，再调用 get_weather 了解天气。
2. 每个地点必须通过 search_pois 搜索获得，严禁编造地点。
3. 相邻地点必须调用 calc_transit 获取真实交通耗时，不得估算。
4. 同一天的地点地理上集中，减少跨区往返；每天跨江/跨区移动不超过1次。
5. 【重要】整个行程中每个地点只能出现一次，绝对禁止在不同天重复安排同一个景点或餐厅。
6. 【重要】同一天内各时间段不能重叠，前一个结束后才能开始下一个，还要留出交通时间。
7. 每天3-5个地点，含午餐和晚餐，时间09:00-21:00。
8. 雨天减少户外活动。
9. 如果工具返回 error，必须调整参数重新调用（换关键词/换城市/换交通方式），严禁在失败后编造地点或耗时。
10. 完成工具调用后，直接输出 JSON，不要输出任何其他文字、解释或思考过程。

输出格式（纯 JSON，不要 markdown 代码块，不要任何多余文字）：
{"city":"城市名","days":[{"day":1,"date":"日期","theme":"主题","weather":"天气","items":[{"time":"09:00-11:00","name":"地点名","type":"spot或meal","address":"地址","transport_to_next":"交通方式和耗时"}]}],"summary":{"estimated_cost":"约XXX元/人","tips":"一句话贴士"}}`;

// ---------- 从文本中提取 JSON ----------
function extractJSON(text) {
  // 先尝试直接解析
  try { return JSON.parse(text.trim()); } catch {}
  // 尝试去掉 markdown 代码块
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}
  // 尝试提取第一个 { 到最后一个 } 之间的内容
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

// ---------- 行程校验 ----------
function validatePlan(plan) {
  const issues = [];
  const allNames = new Set();
  for (const day of plan.days || []) {
    let prevEnd = 0;
    for (const item of day.items || []) {
      // 检查重复
      if (allNames.has(item.name)) issues.push(`⚠️ 地点重复：${item.name} 出现在多天`);
      allNames.add(item.name);
      // 检查时间重叠
      const [startStr, endStr] = item.time.split('-');
      const start = parseInt(startStr?.replace(':',''));
      const end = parseInt(endStr?.replace(':',''));
      if (start && start < prevEnd) issues.push(`⚠️ Day${day.day} 时间重叠：${item.name}(${item.time})`);
      if (end) prevEnd = end;
    }
  }
  return issues;
}

// ---------- Agent 主循环 ----------
async function runAgent(userRequest) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userRequest },
  ];
  console.log('🤖 Agent 启动，开始规划行程...\n');
  for (let round = 1; round <= 20; round++) {
    console.log(`────────── 第 ${round} 轮思考 ──────────`);
    const response = await llm.chat.completions.create({ model: LLM_MODEL, messages, tools, tool_choice: 'auto', temperature: 0.3 });
    const msg = response.choices[0].message;
    messages.push(msg);
    if (!msg.tool_calls || msg.tool_calls.length === 0) { console.log('\n✅ 规划完成！\n'); return msg.content; }
    for (const tc of msg.tool_calls) {
      let args;
      let result;
      try {
        args = JSON.parse(tc.function.arguments);
      } catch {
        result = { error: '工具参数不是合法 JSON，请按 schema 重新生成参数' };
      }
      if (!result) {
        switch (tc.function.name) {
          case 'geocode': console.log(`🔧 geocode("${args.address}")`); result = await amapGeocode(args.address); break;
          case 'get_weather': console.log(`🔧 get_weather(${args.adcode})`); result = await amapWeather(args.adcode); break;
          case 'search_pois': console.log(`🔧 search_pois("${args.keywords}")`); result = await amapSearchPOI(args); break;
          case 'calc_transit': console.log(`🔧 calc_transit(${args.origin?.slice(0,8)}… → ${args.destination?.slice(0,8)}…)`); result = await amapTransit(args); break;
          default: result = { error: '未知工具' };
        }
      }
      console.log('   →', result.error ? `❌ ${result.error}` : `✅ 数据`);
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }
  throw new Error('超过最大轮次');
}

// ---------- 运行 ----------
const userRequest = '帮我规划一个武汉3日游，喜欢人文历史和美食，预算2000元，节奏适中。';
console.log('📝 需求：', userRequest, '\n');
const result = await runAgent(userRequest);

const plan = extractJSON(result);
if (!plan) {
  console.log('⚠️ 未能解析行程，原始输出如下：\n');
  console.log(result);
} else {
  console.log('═══════════════════════════════════════');
  console.log(`  ${plan.city} · ${plan.days.length}日行程`);
  console.log('═══════════════════════════════════════');
  for (const day of plan.days) {
    console.log(`\n📅 Day ${day.day}  ${day.theme}  (${day.weather})`);
    for (const item of day.items) {
      const icon = item.type === 'meal' ? '🍜' : '📍';
      console.log(`  ${icon} ${item.time}  ${item.name}`);
      if (item.transport_to_next) console.log(`     └─ 🚇 ${item.transport_to_next}`);
    }
  }
  if (plan.summary) {
    console.log('\n───────────────────────────────────────');
    console.log(`💰 预估花费：${plan.summary.estimated_cost}`);
    console.log(`💡 ${plan.summary.tips}`);
  }
  const issues = validatePlan(plan);
  if (issues.length) {
    console.log('\n───────────────────────────────────────');
    console.log('🔍 校验发现以下问题：');
    issues.forEach(i => console.log('  ' + i));
  } else {
    console.log('\n✅ 行程校验通过：无重复地点、无时间重叠');
  }
}