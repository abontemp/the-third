import type { PushPayload } from '@/lib/webpush'

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!userIds.length) return
  await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, payload }),
  }).catch(() => {}) // silently fail — push is best-effort
}
