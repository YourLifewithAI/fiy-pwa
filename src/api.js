/**
 * FIY API Client
 *
 * Wraps all REST calls to api.fiy.app. Every function returns the parsed
 * JSON body or throws an Error with a human-readable message.
 */

import { API_BASE, API_KEY } from './config';

async function request(path, options = {}) {
  const url = `${API_BASE}/api/v1${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.detail || body.error || message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }

  return res.json();
}

/**
 * Start a new diagnostic session.
 * @param {string} imageBase64 - Base64-encoded JPEG/PNG
 * @param {string} mediaType - MIME type (image/jpeg, image/png, etc.)
 * @param {string|null} symptom - User's problem description
 * @returns {Promise<Object>} Session data with session_id, vision_result, confirm_prompt
 */
export async function startDiagnosis(imageBase64, mediaType, symptom = null) {
  return request('/diagnose', {
    method: 'POST',
    body: JSON.stringify({
      image_base64: imageBase64,
      media_type: mediaType,
      initial_symptom: symptom || undefined,
    }),
  });
}

/**
 * Advance the diagnostic interview.
 * @param {string} sessionId
 * @param {Object} answer - { answer_type, confirmed?, product_name?, brand?, model_number?, question_id?, answer? }
 * @returns {Promise<Object>} Next question or final recommendation
 */
export async function answerQuestion(sessionId, answer) {
  return request(`/diagnose/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify(answer),
  });
}

/**
 * Submit fix verification.
 * @param {string} sessionId
 * @param {string} outcome - fixed|partially_fixed|not_fixed|not_attempted|scrapped
 * @param {string|null} notes
 * @returns {Promise<Object>}
 */
export async function verifyFix(sessionId, outcome, notes = null) {
  return request(`/fix_verify/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({ outcome, notes: notes || undefined }),
  });
}

/**
 * Health check.
 * @returns {Promise<Object>}
 */
export async function healthCheck() {
  return request('/health', { method: 'GET' });
}
