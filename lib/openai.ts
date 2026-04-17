import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY!,
  dangerouslyAllowBrowser: true,
});

export async function checkCommentTone(comment: string): Promise<{
  isWarm: boolean;
  suggestion: string | null;
}> {
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          '你是一个善意过滤器。判断评论是否温暖积极。如果评论包含阴阳怪气、冷嘲热讽或中性偏冷的语气，返回JSON: {"isWarm": false, "suggestion": "改写后的温暖版本"}。否则返回 {"isWarm": true, "suggestion": null}。只返回JSON，不要其他内容。',
      },
      { role: 'user', content: comment },
    ],
    temperature: 0.3,
  });

  try {
    const text = res.choices[0].message.content ?? '{}';
    return JSON.parse(text);
  } catch {
    return { isWarm: true, suggestion: null };
  }
}

export async function extractKeywords(content: string): Promise<string[]> {
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          '从用户动态中提取2-4个核心关键词，用于模糊状态下展示。以JSON数组返回，如 ["拿下大单", "坚持运动"]。只返回JSON数组。',
      },
      { role: 'user', content },
    ],
    temperature: 0.3,
  });

  try {
    const text = res.choices[0].message.content ?? '[]';
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export async function generateAvatarColors(content: string): Promise<string[]> {
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          '根据用户第一条动态的情感基调，生成3个渐变色（十六进制）作为色彩人格图谱。返回JSON数组，如 ["#7C3AED", "#EC4899", "#F59E0B"]。只返回JSON数组。',
      },
      { role: 'user', content },
    ],
    temperature: 0.7,
  });

  try {
    const text = res.choices[0].message.content ?? '[]';
    return JSON.parse(text);
  } catch {
    return ['#7C3AED', '#EC4899', '#F59E0B'];
  }
}
