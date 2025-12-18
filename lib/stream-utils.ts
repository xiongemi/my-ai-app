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

  // Log all stream events to understand format (use console.log so it shows up)
  if (data.type) {
    console.log('[StreamUtils] Processing stream event:', {
      type: data.type,
      hasTextDelta: !!data.textDelta,
      hasText: !!data.text,
      hasContent: !!data.content,
      textDeltaPreview: data.textDelta?.substring(0, 100),
      textPreview: data.text?.substring(0, 100),
      keys: Object.keys(data),
      fullData: JSON.stringify(data).substring(0, 500), // Log full data structure
    });
  } else {
    // Log if we get data without a type
    console.log('[StreamUtils] Data without type:', {
      keys: Object.keys(data),
      preview: JSON.stringify(data).substring(0, 200),
    });
  }

  // Extract text deltas
  if (data.type === 'text-delta' && data.textDelta) {
    text += data.textDelta;
  }

  // Extract full text from text chunks (replaces accumulated text)
  if (data.type === 'text' && data.text) {
    text = data.text;
  }

  // Handle text-chunk type (alternative format)
  if (data.type === 'text-chunk' && data.text) {
    text += data.text;
  }

  // Handle content array (some providers send content as array)
  if (data.content && Array.isArray(data.content)) {
    const textParts = data.content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text || part.textDelta || '')
      .join('');
    if (textParts) {
      text += textParts;
    }
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
  let chunkCount = 0;

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunkCount++;
          
          // Check if controller is still open before enqueueing
          // This handles the case where the stream was stopped/cancelled
          try {
            // Forward the chunk immediately
            controller.enqueue(value);
          } catch (enqueueError: any) {
            // If controller is closed (e.g., stream was stopped), break the loop
            if (enqueueError?.name === 'InvalidStateError' || enqueueError?.code === 'ERR_INVALID_STATE') {
              console.log('[StreamUtils] Stream was stopped, controller closed');
              break;
            }
            throw enqueueError;
          }

          // Decode and accumulate chunks for parsing
          const decoded = decoder.decode(value, { stream: true });
          buffer += decoded;

          // Log first few chunks to understand format (use console.log so it shows up)
          if (chunkCount <= 5) {
            console.log('[StreamUtils] Chunk', chunkCount, ':', {
              length: decoded.length,
              preview: decoded.substring(0, 300),
              hasNewline: decoded.includes('\n'),
              firstChars: Array.from(decoded.substring(0, 50)).map(c => c.charCodeAt(0)),
            });
          }

          // Process complete lines from the buffer
          const processed = processStreamBuffer(buffer, result);
          buffer = processed.buffer;
          result = processed.result;
        }

        // Process any remaining buffer
        result = processRemainingBuffer(buffer, result);

        // Log final result
        console.log('[StreamUtils] Stream completed:', {
          chunkCount,
          textLength: result.text.length,
          hasUsage: !!result.usage,
          remainingBufferLength: buffer.length,
          bufferPreview: buffer.substring(0, 500), // Show what's left in buffer
          lastFewLines: buffer.split('\n').slice(-5), // Show last few lines
        });

        // Call completion callback only if we have text (stream wasn't stopped early)
        if (result.text) {
          onComplete(result);
        }

        // Only close controller if it's still open
        try {
          controller.close();
        } catch (closeError: any) {
          // Controller might already be closed if stream was stopped
          if (closeError?.name !== 'InvalidStateError' && closeError?.code !== 'ERR_INVALID_STATE') {
            console.warn('[StreamUtils] Error closing controller:', closeError);
          }
        }
      } catch (error: any) {
        // Handle cancellation/abort gracefully
        if (error?.name === 'AbortError' || error?.message?.includes('aborted')) {
          console.log('[StreamUtils] Stream was aborted');
          try {
            controller.close();
          } catch {
            // Controller might already be closed
          }
          return;
        }
        
        console.error('[StreamUtils] Error processing stream:', error);
        try {
          controller.error(error);
        } catch (errorError: any) {
          // Controller might already be closed
          if (errorError?.name !== 'InvalidStateError' && errorError?.code !== 'ERR_INVALID_STATE') {
            console.error('[StreamUtils] Error setting error on controller:', errorError);
          }
        }
      }
    },
    cancel() {
      // Handle stream cancellation (e.g., when stop button is clicked)
      console.log('[StreamUtils] Stream cancelled');
      reader.cancel().catch(() => {
        // Ignore cancellation errors
      });
    },
  });
}
