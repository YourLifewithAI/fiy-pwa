/**
 * FIY PWA Configuration
 *
 * API_KEY: Public-facing key for v1. The API has a $5/day budget cap
 * as a safety net. This will be replaced with proper auth in a future sprint.
 */

export const API_BASE = import.meta.env.VITE_API_BASE || 'https://api.fiy.app';
export const API_KEY = import.meta.env.VITE_API_KEY || '';
