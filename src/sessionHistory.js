/**
 * FIY Session History — localStorage persistence
 *
 * Stores recent diagnostic sessions so users can return to them later.
 * Each entry has: sessionId, productName, brand, timestamp.
 * Capped at 20 entries (most recent first).
 */

const STORAGE_KEY = 'fiy_session_history';

export function saveSessionToHistory(sessionId, productName, brand) {
  const history = getSessionHistory();
  const entry = {
    sessionId,
    productName: productName || 'Unknown product',
    brand: brand || '',
    timestamp: Date.now(),
  };
  // Dedupe (update existing entry) and prepend
  const filtered = history.filter(h => h.sessionId !== sessionId);
  const updated = [entry, ...filtered].slice(0, 20);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

export function getSessionHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
