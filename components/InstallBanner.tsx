'use client'

import { useState, useEffect } from 'react'
import { X, Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Déjà installée ou déjà ignorée → ne pas afficher
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      localStorage.getItem('pwa-banner-dismissed') === 'true'
    ) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as unknown as { standalone?: boolean }).standalone
    setIsIOS(ios)

    if (ios) {
      setShow(true)
      return
    }

    // Android / Chrome : écouter l'event d'installation
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') dismiss()
  }

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('pwa-banner-dismissed', 'true')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-area-pb">
      <div className="max-w-lg mx-auto bg-slate-800 border border-white/20 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <img src="/logo.svg" alt="The Third" className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">Installer The Third</p>
            {isIOS ? (
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                Appuie sur <Share size={12} className="inline mb-0.5" /> puis{' '}
                <strong className="text-gray-300">"Sur l'écran d'accueil"</strong> pour installer l'app
              </p>
            ) : (
              <p className="text-gray-400 text-xs mt-1">
                Accès rapide depuis ton écran d'accueil, sans navigateur
              </p>
            )}
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 transition shrink-0">
            <X size={18} />
          </button>
        </div>

        {!isIOS && (
          <button
            onClick={handleInstall}
            className="mt-3 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Installer l'application
          </button>
        )}
      </div>
    </div>
  )
}
