import {
  transformStreamToCollectData,
  type StreamParseResult,
} from '@/lib/stream-utils';

// Use Node.js web streams API if available, otherwise create a simple polyfill
let ReadableStreamImpl: typeof ReadableStream;
try {
  // Try to use Node.js built-in web streams (Node 18+)
  ReadableStreamImpl = require('stream/web').ReadableStream;
} catch {
  // Fallback polyfill for older Node versions or jsdom
  ReadableStreamImpl = class ReadableStream {
    _underlyingSource: any;
    constructor(underlyingSource?: any) {
      this._underlyingSource = underlyingSource;
    }
    getReader() {
      const chunks: Uint8Array[] = [];
      let index = 0;

      if (this._underlyingSource?.start) {
        const controller = {
          enqueue: (chunk: Uint8Array) => {
            chunks.push(chunk);
          },
          close: () => {
            // Stream is closed
          },
        };
        // Execute start synchronously to populate chunks
        const startResult = this._underlyingSource.start(controller);
        // If start returns a promise, wait for it
        if (startResult && typeof startResult.then === 'function') {
          startResult.catch(() => {});
        }
      }

      return {
        read: async () => {
          if (index >= chunks.length) {
            return { done: true, value: undefined };
          }
          const value = chunks[index++];
          return { done: false, value };
        },
      };
    }
  } as any;
}

// Polyfill TextEncoder/TextDecoder if needed
if (typeof TextEncoder === 'undefined') {
  // @ts-ignore
  global.TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      return new Uint8Array(Buffer.from(str, 'utf8'));
    }
  };
}

if (typeof TextDecoder === 'undefined') {
  // @ts-ignore
  global.TextDecoder = class TextDecoder {
    decode(bytes: Uint8Array, options?: { stream?: boolean }): string {
      return Buffer.from(bytes).toString('utf8');
    }
  };
}

// Set ReadableStream globally if not available
if (typeof ReadableStream === 'undefined') {
  // @ts-ignore
  global.ReadableStream = ReadableStreamImpl;
}

describe('stream-utils', () => {
  describe('transformStreamToCollectData', () => {
    it('should collect text from text-delta events', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Hello"}\n',
        '0:{"type":"text-delta","textDelta":" World"}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      // Read all chunks
      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Hello World');
      expect(result!.usage).toBeNull();
    });

    it('should replace text when receiving full text event', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Hello"}\n',
        '0:{"type":"text","text":"Complete Text"}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Complete Text');
    });

    it('should extract usage from finish event with promptTokens/completionTokens', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Test"}\n',
        '0:{"type":"finish","usage":{"promptTokens":100,"completionTokens":50,"totalTokens":150}}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it('should extract usage from finish event with inputTokens/outputTokens', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Test"}\n',
        '0:{"type":"finish","usage":{"inputTokens":200,"outputTokens":100}}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.usage).toEqual({
        promptTokens: 200,
        completionTokens: 100,
        totalTokens: 300,
      });
    });

    it('should extract usage from metadata', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Test"}\n',
        '0:{"type":"finish","metadata":{"usage":{"promptTokens":10,"completionTokens":20,"totalTokens":30}}}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.usage).toEqual({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it('should handle incomplete lines across chunks', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Hello"}\n0:{"type":"text-delta"',
        ',"textDelta":" World"}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Hello World');
    });

    it('should handle multiple lines in a single chunk', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"A"}\n0:{"type":"text-delta","textDelta":"B"}\n0:{"type":"text-delta","textDelta":"C"}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('ABC');
    });

    it('should ignore malformed JSON lines', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Hello"}\n',
        'invalid json line\n',
        '0:{"type":"text-delta","textDelta":" World"}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Hello World');
    });

    it('should ignore lines that do not match expected format', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Hello"}\n',
        'not-a-valid-line\n',
        '0:{"type":"text-delta","textDelta":" World"}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Hello World');
    });

    it('should handle empty stream', async () => {
      const stream = createTestStream([]);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('');
      expect(result!.usage).toBeNull();
    });

    it('should forward all chunks to the output stream', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Hello"}\n',
        '0:{"type":"text-delta","textDelta":" World"}\n',
      ];
      const stream = createTestStream(chunks);

      const transformed = transformStreamToCollectData(stream, () => {});

      const reader = transformed.getReader();
      const receivedChunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedChunks.push(value);
        }
      }

      // Should receive the same number of chunks
      expect(receivedChunks.length).toBe(chunks.length);
    });

    it('should handle usage with missing totalTokens (calculate it)', async () => {
      const chunks = [
        '0:{"type":"finish","usage":{"promptTokens":100,"completionTokens":50}}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it('should handle finish event without usage', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Test"}\n',
        '0:{"type":"finish"}\n',
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Test');
      expect(result!.usage).toBeNull();
    });

    it('should handle remaining buffer after stream ends', async () => {
      const chunks = [
        '0:{"type":"text-delta","textDelta":"Hello"}\n',
        '0:{"type":"text-delta","textDelta":" World"}', // No newline at end
      ];
      const stream = createTestStream(chunks);

      let result: StreamParseResult | null = null;
      const transformed = transformStreamToCollectData(stream, (data) => {
        result = data;
      });

      const reader = transformed.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      expect(result).not.toBeNull();
      expect(result!.text).toBe('Hello World');
    });
  });
});

/**
 * Helper function to create a test ReadableStream from string chunks
 */
function createTestStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStreamImpl({
    start(controller) {
      // Enqueue chunks asynchronously to simulate real stream behavior
      Promise.resolve().then(() => {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      });
    },
  });
}

