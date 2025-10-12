'use client'

import { useState } from 'react'
import { Trophy, Users, Vote, TrendingUp, Menu, X, ChevronRight, Zap } from 'lucide-react'

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <nav className="fixed top-0 w-full bg-slate-900/95 backdrop-blur-sm z-50 border-b border-blue-800/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-orange-500 rounded-lg flex items-center justify-center font-bold text-white">
                T3
              </div>
              <span className="text-xl font-bold text-white">The Third</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition">Fonctionnalités</a>
              <a href="/login" className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-2 rounded-lg hover:shadow-lg transition">
                Commencer
              </a>
            </div>

            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

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
          
          <a href="/login" className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:shadow-xl transition">
            Commencer gratuitement
            <ChevronRight size={20} />
          </a>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Fonctionnalités principales
            </h2>
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

      <footer className="bg-slate-900 border-t border-blue-800/30 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>&copy; 2025 The Third. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  )
}