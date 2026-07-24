import '@testing-library/jest-dom'

// jsdom does not implement BroadcastChannel. Explicitly install Node's
// built-in implementation onto globalThis so tests get consistent behavior
// regardless of which jsdom version is resolved in a given environment.
if (typeof globalThis.BroadcastChannel === 'undefined') {
  const { BroadcastChannel } = await import('node:worker_threads')
  globalThis.BroadcastChannel = BroadcastChannel
}
