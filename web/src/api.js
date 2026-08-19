// 调用后端 SSE 接口，流式解析进度事件
export async function streamPlan(request, onEvent) {
  const res = await fetch('/api/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request }),
  });
  if (!res.ok || !res.body) throw new Error(`请求失败（${res.status}）`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (raw.startsWith('data: ')) {
        try { onEvent(JSON.parse(raw.slice(6))); } catch {}
      }
    }
  }
}

export async function replan(plan, message, onEvent) {
  const res = await fetch('/api/replan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, message }),
  });
  if (!res.ok || !res.body) throw new Error(`请求失败（${res.status}）`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (raw.startsWith('data: ')) {
        try { onEvent(JSON.parse(raw.slice(6))); } catch {}
      }
    }
  }
}
