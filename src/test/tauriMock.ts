// Mock Tauri APIs for browser-based testing (E2E via Playwright)
// When running in a browser (not Tauri), these mocks prevent import errors

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

export function isTauriEnvironment(): boolean {
  return isTauri;
}
