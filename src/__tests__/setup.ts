import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

global.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver (satisfies lib.dom IntersectionObserver shape)
class IntersectionObserverMock implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = (): IntersectionObserverEntry[] => [];
}

global.IntersectionObserver = IntersectionObserverMock as typeof IntersectionObserver;

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Suppress console errors during tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out React 18 act() warnings
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('act') || args[0].includes('ReactDOMTestUtils.act'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
