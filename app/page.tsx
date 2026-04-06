'use client'

import { useState, useEffect } from 'react'
import { Trophy, Users, Vote, TrendingUp, Menu, X, ChevronRight, Zap, LayoutDashboard, Download, Share } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })

    // Déjà installée ?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true)
      return
    }
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
  }

  const showInstallButton = !isInstalled && (installPrompt !== null || isIOS)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* NAV */}
      <nav className="fixed top-0 w-full bg-slate-900/95 backdrop-blur-sm z-50 border-b border-blue-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="The Third" className="w-10 h-10" />
              <span className="text-xl font-bold text-white">The Third</span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-gray-300 hover:text-white transition">Fonctionnalités</a>
              {showInstallButton && (
                <button
                  onClick={handleInstall}
                  className="flex items-center gap-2 text-gray-300 hover:text-white transition"
                >
                  <Download size={18} />
                  Installer l&apos;app
                </button>
              )}
              {isLoggedIn ? (
                <a href="/dashboard" className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition font-semibold">
                  <LayoutDashboard size={18} />
                  Mon dashboard
                </a>
              ) : (
                <a href="/login" className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-lg hover:shadow-lg transition font-semibold">
                  Commencer
                </a>
              )}
            </div>

            {/* Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-2"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-slate-900">
            <div className="px-4 py-4 space-y-3">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-gray-300 hover:text-white py-2 transition"
              >
                Fonctionnalités
              </a>
              {showInstallButton && (
                <button
                  onClick={() => { handleInstall(); setMobileMenuOpen(false) }}
                  className="w-full flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-xl font-semibold transition"
                >
                  <Download size={18} />
                  Installer l&apos;application
                </button>
              )}
              {isLoggedIn ? (
                <a
                  href="/dashboard"
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-xl font-semibold transition"
                >
                  <LayoutDashboard size={18} />
                  Mon dashboard
                </a>
              ) : (
                <a
                  href="/login"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-3 rounded-xl font-semibold transition"
                >
                  Commencer
                </a>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 px-4 py-2 rounded-full mb-6 border border-blue-500/30">
            <Zap size={16} />
            <span className="text-sm font-medium">L&apos;esprit d&apos;équipe réinventé</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Élisez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-orange-500">Top</span> et votre{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">Flop</span>
          </h1>

          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Renforcez la cohésion de votre équipe sportive avec des votes anonymes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-xl text-lg font-semibold hover:shadow-xl transition">
              Commencer gratuitement
              <ChevronRight size={20} />
            </a>

            {showInstallButton && (
              <button
                onClick={handleInstall}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-8 py-4 rounded-xl text-lg font-semibold transition"
              >
                <Download size={20} />
                {isIOS ? 'Installer sur iPhone' : 'Installer l\'app'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Fonctionnalités principales</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-blue-900/50 to-slate-800/50 p-6 rounded-xl border border-blue-800/30">
              <Users className="text-blue-400 mb-4" size={32} />
              <h3 className="text-xl font-bold text-white mb-2">Gestion d&apos;équipes</h3>
              <p className="text-gray-400">Créez et gérez vos équipes facilement.</p>
            </div>
            <div className="bg-gradient-to-br from-orange-900/50 to-slate-800/50 p-6 rounded-xl border border-orange-800/30">
              <Vote className="text-orange-400 mb-4" size={32} />
              <h3 className="text-xl font-bold text-white mb-2">Votes anonymes</h3>
              <p className="text-gray-400">Votez pour votre Top et Flop.</p>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-slate-800/50 p-6 rounded-xl border border-purple-800/30">
              <Trophy className="text-purple-400 mb-4" size={32} />
              <h3 className="text-xl font-bold text-white mb-2">Lecture publique</h3>
              <p className="text-gray-400">Révélez les votes de manière spectaculaire.</p>
            </div>
            <div className="bg-gradient-to-br from-green-900/50 to-slate-800/50 p-6 rounded-xl border border-green-800/30">
              <TrendingUp className="text-green-400 mb-4" size={32} />
              <h3 className="text-xl font-bold text-white mb-2">Statistiques</h3>
              <p className="text-gray-400">Suivez les performances de votre équipe.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-blue-800/30 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>&copy; 2025 The Third. Tous droits réservés.</p>
        </div>
      </footer>

      {/* Modal instructions iOS */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowIOSInstructions(false)}>
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">Installer sur iPhone</h3>
              <button onClick={() => setShowIOSInstructions(false)} className="text-gray-400">
                <X size={20} />
              </button>
            </div>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                <p className="text-gray-300 text-sm">Appuie sur l&apos;icône <Share size={14} className="inline mx-1 text-blue-400" /><strong className="text-white">Partager</strong> en bas de Safari</p>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                <p className="text-gray-300 text-sm">Fais défiler et appuie sur <strong className="text-white">"Sur l'écran d'accueil"</strong></p>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                <p className="text-gray-300 text-sm">Appuie sur <strong className="text-white">"Ajouter"</strong> en haut à droite</p>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition"
            >
              Compris !
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
