import '@testing-library/jest-dom';

// Polyfill for TransformStream which is not available in jsdom environment
if (typeof globalThis.TransformStream === 'undefined') {
  // @ts-ignore - TransformStream polyfill
  globalThis.TransformStream = class TransformStream {
    constructor() {
      // Minimal polyfill - actual implementation not needed for tests
    }
  };
}

