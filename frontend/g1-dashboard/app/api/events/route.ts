/**
 * /api/events — Lightweight real-time notification endpoint.
 *
 * Architecture:
 *   POST  → Called by the MQTT listener whenever state changes. Bumps a
 *            monotonic counter stored on the global object.
 *   GET   → Returns immediately with the current counter value.
 *            The client polls every few seconds and compares counters.
 *
 * Why not SSE / long-polling?
 *   Turbopack (Next.js 16 dev mode) uses Node's AsyncHook to track every
 *   Promise created inside route handlers. Long-lived Promises (SSE streams,
 *   long-poll Promises held by setTimeout) are never GC'd by Turbopack's
 *   internal Map, eventually hitting "RangeError: Map maximum size exceeded"
 *   and crashing the entire dev server. Returning immediately avoids this.
 */

export const dynamic = 'force-dynamic';

// Monotonic update counter persisted across hot reloads via globalThis
const g = globalThis as unknown as { __eventSeq: number };
if (g.__eventSeq == null) g.__eventSeq = 0;

export async function GET() {
  return Response.json({ seq: g.__eventSeq });
}

export async function POST() {
  g.__eventSeq += 1;
  return Response.json({ success: true, seq: g.__eventSeq });
}
