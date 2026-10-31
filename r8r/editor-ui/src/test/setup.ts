/**
 * jsdom lacks a handful of browser APIs that Mantine and React Flow expect.
 * Stubbing them here keeps every test file free of boilerplate.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

if (!window.crypto?.randomUUID) {
  Object.defineProperty(window, 'crypto', {
    value: { ...window.crypto, randomUUID: () => `test-${Math.random().toString(16).slice(2)}` },
  })
}

// jsdom does not implement scrollIntoView, which Mantine's Select calls.
Element.prototype.scrollIntoView = vi.fn()

// Mantine's autosizing Textarea waits for webfonts to settle; jsdom has no
// FontFaceSet.
if (!document.fonts) {
  Object.defineProperty(document, 'fonts', {
    writable: true,
    value: { addEventListener: vi.fn(), removeEventListener: vi.fn(), ready: Promise.resolve() },
  })
}

// Mantine's autosizing Textarea subscribes to the visual viewport, which jsdom
// does not provide.
if (!window.visualViewport) {
  Object.defineProperty(window, 'visualViewport', {
    writable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      width: 1024,
      height: 768,
      scale: 1,
    },
  })
}
