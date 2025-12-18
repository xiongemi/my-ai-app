/**
 * Stream parsing utilities for AI SDK responses
 */

import { TokenUsage } from './github-pr';

export interface StreamParseResult {
  text: string;
  usage: TokenUsage | null;
}

/**
 * Parses a single line from the AI SDK stream format
 * Lines are in format: "0:{"type":"text-delta","textDelta":"..."}"
 * @param line - The line to parse
 * @returns Parsed data or null if line doesn't match expected format
 */
function parseStreamLine(line: string): any | null {
  if (!line.trim()) return null;

  // AI SDK stream format: lines start with "0:", "1:", etc. followed by JSON
  const match = line.match(/^\d+:(.*)$/);
  if (!match) return null;

  try {
    const jsonStr = match[1];
    return JSON.parse(jsonStr);
  } catch (parseError) {
    // Ignore parse errors for malformed JSON
    return null;
  }
}

/**
 * Extracts text and usage from parsed stream data
 * @param data - Parsed JSON data from stream line
 * @param currentText - Accumulated text so far
 * @param currentUsage - Current usage data (if any)
 * @returns Updated text and usage
 */
function extractFromStreamData(
  data: any,
  currentText: string,
  currentUsage: TokenUsage | null,
): { text: string; usage: TokenUsage | null } {
  let text = currentText;
  let usage = currentUsage;

  // Extract text deltas
  if (data.type === 'text-delta' && data.textDelta) {
    text += data.textDelta;
  }

  // Extract full text from text chunks (replaces accumulated text)
  if (data.type === 'text' && data.text) {
    text = data.text;
  }

  // Extract usage from finish event
  if (data.type === 'finish' && data.usage) {
    usage = {
      promptTokens: data.usage.promptTokens ?? data.usage.inputTokens ?? 0,
      completionTokens:
        data.usage.completionTokens ?? data.usage.outputTokens ?? 0,
      totalTokens:
        data.usage.totalTokens ??
        (data.usage.promptTokens ?? data.usage.inputTokens ?? 0) +
          (data.usage.completionTokens ?? data.usage.outputTokens ?? 0),
    };
  }

  // Also check for usage in message metadata
  if (data.metadata?.usage) {
    usage = {
      promptTokens: data.metadata.usage.promptTokens ?? 0,
      completionTokens: data.metadata.usage.completionTokens ?? 0,
      totalTokens:
        data.metadata.usage.totalTokens ??
        (data.metadata.usage.promptTokens ?? 0) +
          (data.metadata.usage.completionTokens ?? 0),
    };
  }

  return { text, usage };
}

/**
 * Processes a buffer of stream data, extracting complete lines
 * @param buffer - Accumulated buffer string
 * @param result - Current parse result
 * @returns Updated buffer and parse result
 */
function processStreamBuffer(
  buffer: string,
  result: StreamParseResult,
): { buffer: string; result: StreamParseResult } {
  // Process complete lines from the buffer
  const lines = buffer.split('\n');
  // Keep the last incomplete line in the buffer
  const newBuffer = lines.pop() || '';

  let text = result.text;
  let usage = result.usage;

  for (const line of lines) {
    const data = parseStreamLine(line);
    if (data) {
      const extracted = extractFromStreamData(data, text, usage);
      text = extracted.text;
      usage = extracted.usage;
    }
  }

  return {
    buffer: newBuffer,
    result: { text, usage },
  };
}

/**
 * Processes any remaining buffer content after stream ends
 * @param buffer - Remaining buffer string
 * @param result - Current parse result
 * @returns Updated parse result
 */
function processRemainingBuffer(
  buffer: string,
  result: StreamParseResult,
): StreamParseResult {
  if (!buffer.trim()) return result;

  const data = parseStreamLine(buffer);
  if (data) {
    return extractFromStreamData(data, result.text, result.usage);
  }

  return result;
}

/**
 * Transforms a streaming response to collect text and usage data
 * @param stream - The original ReadableStream
 * @param onComplete - Callback called when stream completes with collected text and usage
 * @returns A new ReadableStream that forwards all chunks while collecting data
 */
export function transformStreamToCollectData(
  stream: ReadableStream<Uint8Array>,
  onComplete: (result: StreamParseResult) => void,
): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: StreamParseResult = { text: '', usage: null };

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Forward the chunk immediately
          controller.enqueue(value);

          // Decode and accumulate chunks for parsing
          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from the buffer
          const processed = processStreamBuffer(buffer, result);
          buffer = processed.buffer;
          result = processed.result;
        }

        // Process any remaining buffer
        result = processRemainingBuffer(buffer, result);

        // Call completion callback
        onComplete(result);

        controller.close();
      } catch (error) {
        console.error('[StreamUtils] Error processing stream:', error);
        controller.error(error);
      }
    },
  });
}
