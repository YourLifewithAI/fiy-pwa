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
 * @param {string} imageBase64 - Base64-encoded JPEG/PNG (primary image)
 * @param {string} mediaType - MIME type (image/jpeg, image/png, etc.)
 * @param {string|null} symptom - User's problem description
 * @param {Array|null} additionalImages - [{image_base64, media_type}] additional photos
 * @returns {Promise<Object>} Session data with session_id, vision_result, confirm_prompt
 */
export async function startDiagnosis(imageBase64, mediaType, symptom = null, additionalImages = null) {
  const body = {
    image_base64: imageBase64,
    media_type: mediaType,
    initial_symptom: symptom || undefined,
  };
  if (additionalImages && additionalImages.length > 0) {
    body.additional_images = additionalImages;
  }
  return request('/diagnose', {
    method: 'POST',
    body: JSON.stringify(body),
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
 * Submit fix verification with optional structured feedback.
 * @param {string} sessionId
 * @param {string} outcome - fixed|partially_fixed|not_fixed|not_attempted|scrapped
 * @param {Object} feedback - { notes?, instruction_quality?, feedback_text?, actual_problem? }
 * @returns {Promise<Object>}
 */
export async function verifyFix(sessionId, outcome, feedback = {}) {
  const body = {
    outcome,
    notes: feedback.notes || undefined,
    instruction_quality: feedback.instruction_quality || undefined,
    feedback_text: feedback.feedback_text || undefined,
    actual_problem: feedback.actual_problem || undefined,
  };
  return request(`/fix_verify/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Ask a follow-up question (text or with photo) after diagnosis.
 * @param {string} sessionId
 * @param {string} question - The follow-up question text
 * @param {string|null} imageBase64 - Optional base64-encoded image
 * @param {string} mediaType - MIME type for the image
 * @returns {Promise<Object>} { follow_up_response, follow_up_count, cost_cents }
 */
export async function askFollowUp(sessionId, question, imageBase64 = null, mediaType = 'image/jpeg') {
  const body = {
    answer_type: 'follow_up',
    question,
  };
  if (imageBase64) {
    body.image_base64 = imageBase64;
    body.media_type = mediaType;
  }
  return request(`/diagnose/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Retrieve a completed session (active or expired).
 * Works even after the 30-min in-memory TTL — loads from database.
 * @param {string} sessionId
 * @returns {Promise<Object>} Full session data with recommendation
 */
export async function getSession(sessionId) {
  return request(`/sessions/${sessionId}`, { method: 'GET' });
}

/**
 * Submit verification against any session (active or expired).
 * @param {string} sessionId
 * @param {string} outcome
 * @param {Object} feedback
 * @returns {Promise<Object>}
 */
export async function verifySession(sessionId, outcome, feedback = {}) {
  const body = {
    outcome,
    notes: feedback.notes || undefined,
    instruction_quality: feedback.instruction_quality || undefined,
    feedback_text: feedback.feedback_text || undefined,
    actual_problem: feedback.actual_problem || undefined,
  };
  return request(`/sessions/${sessionId}/verify`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Health check.
 * @returns {Promise<Object>}
 */
export async function healthCheck() {
  return request('/health', { method: 'GET' });
}
