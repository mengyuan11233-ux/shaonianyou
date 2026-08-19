// ============================================================
// 少年游 · 行程校验 + JSON 提取（确定性代码，非 LLM）
// ============================================================

// 从 LLM 输出中提取 JSON（兼容 markdown 代码块 / 多余文字）
export function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.trim()); } catch {}
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

// "HH:MM" → 分钟数；非法返回 null
function toMin(t) {
  if (!t) return null;
  const m = t.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// 规则校验：查重 / 时间重叠 / 缺坐标
export function validatePlan(plan) {
  const issues = [];
  const seen = new Set();
  for (const day of plan.days || []) {
    let prevEnd = 0;
    for (const item of day.items || []) {
      if (seen.has(item.name)) issues.push(`地点重复：${item.name}`);
      seen.add(item.name);
      if (!item.location) issues.push(`缺少坐标：${item.name}`);
      const start = toMin((item.time || '').split('-')[0]);
      const end = toMin((item.time || '').split('-')[1]);
      if (start != null && start < prevEnd) issues.push(`Day${day.day} 时间重叠：${item.name}（${item.time}）`);
      if (end != null) prevEnd = Math.max(prevEnd, end);
    }
  }
  return issues;
}
