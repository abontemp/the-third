'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function PushNotificationManager() {
  useEffect(() => {
    setupPush()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const setupPush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return

      // Vérifier si déjà refusé
      if (Notification.permission === 'denied') return

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const reg = await navigator.serviceWorker.ready

      // Vérifier si déjà abonné
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        // Synchroniser l'abonnement existant silencieusement
        await saveSubscription(existing, user.id)
        return
      }

      // Demander la permission si pas encore donnée
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return
      }

      // S'abonner
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
      })

      await saveSubscription(subscription, user.id)
      logger.log('✅ Push subscription enregistrée')

    } catch (err) {
      logger.error('Push setup error:', err)
    }
  }

  const saveSubscription = async (subscription: PushSubscription, userId: string) => {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), userId }),
    })
  }

  return null
}
