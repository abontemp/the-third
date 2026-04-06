import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { webpush, PushPayload } from '@/lib/webpush'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userIds, payload }: { userIds: string[]; payload: PushPayload } = await req.json()

    if (!userIds?.length || !payload?.title) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    // Récupérer tous les abonnements de ces utilisateurs
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', userIds)

    if (!subscriptions?.length) {
      return NextResponse.json({ ok: true, sent: 0 })
    }

    const results = await Promise.allSettled(
      subscriptions.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        ).catch(async (err) => {
          // Abonnement expiré → supprimer
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint)
          }
          throw err
        })
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ ok: true, sent })
  } catch (err) {
    console.error('Push notify error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
