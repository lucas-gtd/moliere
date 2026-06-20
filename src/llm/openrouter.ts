import { loadConfig } from '../config';
import { moliereTools } from '../tools';

const config = loadConfig();

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export const streamChat = async (messages: Message[], onChunk: (text: string) => void): Promise<Message> => {
  if (!config.apiKey) throw new Error("Clé API manquante.");

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'https://github.com/moliere-agent',
      'X-Title': 'Molière',
    },
    body: JSON.stringify({
      model: config.defaultModel,
      messages: messages,
      tools: moliereTools,
      stream: true,
    }),
  });

  if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
  if (!response.body) throw new Error("Aucun flux de réponse reçu.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  
  let fullResponse = '';
  let buffer = '';
  
  let toolCallId = '';
  let toolCallName = '';
  let toolCallArgs = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          const delta = data.choices[0]?.delta || {};

          if (delta.content) {
            fullResponse += delta.content;
            onChunk(delta.content);
          }

          if (delta.tool_calls) {
            const tc = delta.tool_calls[0];
            if (tc.id) toolCallId = tc.id;
            if (tc.function?.name) toolCallName += tc.function.name;
            if (tc.function?.arguments) toolCallArgs += tc.function.arguments;
          }
        } catch (e) {
            // Silence parsing errors on split chunks
        }
      }
    }
  }

  if (toolCallName) {
    return {
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: toolCallId,
        type: 'function',
        function: { name: toolCallName, arguments: toolCallArgs }
      }]
    };
  }

  return { role: 'assistant', content: fullResponse };
}