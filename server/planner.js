// ============================================================
// 少年游 · Planner（Agent 编排层）
// 构建提示词 → Agent 循环（工具调用）→ 解析 → 校验
// ============================================================

import 'dotenv/config';
import OpenAI from 'openai';
import { TOOL_SCHEMAS, dispatchTool } from './tools.js';
import { buildSystemPrompt } from './prompts.js';
import { extractJSON, validatePlan } from './validate.js';

const LLM_KEY = process.env.LLM_API_KEY;
const LLM_URL = process.env.LLM_BASE_URL;
const LLM_MODEL = process.env.LLM_MODEL;

const llm = new OpenAI({ apiKey: LLM_KEY, baseURL: LLM_URL });
const MAX_ROUNDS = 25;

// 核心：一次完整规划。onProgress(type, payload) 用于 SSE 推送进度。
export async function planTrip(userRequest, { memoryText = '', onProgress = () => {} } = {}) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(memoryText) },
    { role: 'user', content: userRequest },
  ];
  onProgress({ type: 'start', message: '正在为你规划行程…' });

  let totalTools = 0;
  const TOOL_CAP = 40;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const response = await llm.chat.completions.create({
      model: LLM_MODEL, messages, tools: TOOL_SCHEMAS, tool_choice: 'auto', temperature: 0.3,
    });
    const msg = response.choices[0].message;
    messages.push(msg);

    // 无工具调用 → 规划结束，输出最终 JSON
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      let plan = extractJSON(msg.content);
      // 解析失败 → 让 LLM 重新输出合法 JSON（最多重试 2 次）
      for (let retry = 0; retry < 2 && !plan; retry++) {
        messages.push({ role: 'user', content: '你刚才的输出不是合法的 JSON。请只输出一个纯 JSON 对象，不要 markdown 代码块、注释或任何多余文字。' });
        const r = await llm.chat.completions.create({ model: LLM_MODEL, messages, temperature: 0 });
        const m2 = r.choices[0].message;
        messages.push(m2);
        plan = extractJSON(m2.content);
      }
      if (!plan) throw new Error('未能解析 LLM 输出的行程 JSON');
      const issues = validatePlan(plan);
      return { plan, issues };
    }

    // 执行本轮所有工具调用（超过上限则回传提示，强制让模型输出 JSON）
    for (const tc of msg.tool_calls) {
      let args = {};
      let result;
      if (totalTools >= TOOL_CAP) {
        result = { error: '工具调用次数已达上限，请基于已有数据直接输出最终 JSON，不要再调用任何工具' };
      } else {
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          result = { error: '工具参数不是合法 JSON，请按 schema 重新生成参数' };
        }
        if (!result) {
          onProgress({ type: 'tool', name: tc.function.name, args });
          result = await dispatchTool(tc.function.name, args);
          onProgress({ type: 'tool_result', name: tc.function.name, result });
        }
      }
      totalTools++;
      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }
  throw new Error('超过最大工具调用轮次');
}

// 旅行中重新规划：基于已有行程 + 用户修改，只调整受影响部分
export async function replanTrip(existingPlan, userMessage, opts = {}) {
  const request = `这是你之前生成的旅行计划（JSON）：\n${JSON.stringify(existingPlan)}\n\n用户现在提出：「${userMessage}」\n请基于现有计划重新规划：保留不受影响的部分，只调整与用户修改相关的天/地点，并重新计算相关路线。`;
  return planTrip(request, opts);
}
