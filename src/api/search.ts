import { apiBaseUrl, fetchJson, resolveDataSource } from './client';
import * as mockSource from './mockSource';
import type { AnswerResponse, SearchResult } from '../types';

type AnswerQuestionInput = Parameters<typeof mockSource.answerQuestion>[0];

export function rewriteSearchQuery(query: string): Promise<string> {
  if (resolveDataSource() === 'mock') {
    return Promise.resolve(mockSource.rewriteSearchQuery(query));
  }

  return fetchJson<{ query: string }>('/api/search/rewrite', {
    body: JSON.stringify({ query }),
    method: 'POST',
  }).then((response) => response.query);
}

export function searchCards(query: string): Promise<SearchResult[]> {
  if (resolveDataSource() === 'mock') {
    return mockSource.searchCards(query);
  }

  return fetchJson<SearchResult[]>('/search', {
    body: JSON.stringify({ query }),
    method: 'POST',
  });
}

export function answerQuestion(input: AnswerQuestionInput): Promise<AnswerResponse> {
  if (resolveDataSource() === 'mock') {
    return mockSource.answerQuestion(input);
  }

  return fetchJson<AnswerResponse>('/answer', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export async function streamAnswerQuestion(
  input: AnswerQuestionInput,
  onToken: (token: string) => void,
): Promise<{ answer: string; model: string }> {
  if (resolveDataSource() === 'mock') {
    const response = await mockSource.answerQuestion(input);
    for (const token of response.answer.match(/.{1,4}/gu) ?? []) {
      onToken(token);
      await new Promise((resolve) => window.setTimeout(resolve, 12));
    }
    return { answer: response.answer, model: response.model };
  }

  const response = await fetch(`${apiBaseUrl}/answer/stream`, {
    body: JSON.stringify(input),
    headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok || !response.body) {
    throw new Error('回答生成失败，请稍后重试。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let model = '';

  const handleEvent = (rawEvent: string) => {
    const lines = rawEvent.split('\n');
    const event = lines.find((line) => line.startsWith('event:'))?.replace('event:', '').trim() ?? 'message';
    const dataText = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace('data:', '').trim())
      .join('\n');
    if (!dataText) return;
    const data = JSON.parse(dataText) as { token?: string; answer?: string; model?: string; message?: string };
    if (event === 'token' && data.token) {
      answer += data.token;
      onToken(data.token);
    }
    if (event === 'done') {
      answer = data.answer ?? answer;
      model = data.model ?? '';
    }
    if (event === 'error') {
      throw new Error(data.message || '回答生成失败，请稍后重试。');
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      handleEvent(event);
    }
  }
  if (buffer.trim()) handleEvent(buffer);

  return { answer, model };
}
