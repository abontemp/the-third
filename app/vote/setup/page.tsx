'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import { ArrowLeft, Send, AlertCircle, CheckCircle, Loader, Sparkles, Target } from 'lucide-react'

type Season = {
  id: string
  name: string
  is_active: boolean
}

export default function VoteSetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [seasons, setSeasons] = useState<Season[]>([])

  const [formData, setFormData] = useState({
    seasonId: '',
    opponent: '',
    matchDate: new Date().toISOString().split('T')[0],
    location: '',
    enablePredictions: false,
    enableBestMove: false
  })

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const selectedTeamId = localStorage.getItem('selectedTeamId')

      if (!selectedTeamId) {
        setError("Aucune équipe sélectionnée")
        router.push('/dashboard')
        return
      }

      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .eq('team_id', selectedTeamId)
        .single()

      if (!membership) {
        setError("Vous ne faites pas partie de cette équipe")
        router.push('/dashboard')
        return
      }

      if (membership.role !== 'creator' && membership.role !== 'manager') {
        setError("Vous devez être manager pour créer un match")
        return
      }

      // Charger les saisons actives
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('id, name, is_active')
        .eq('team_id', membership.team_id)
        .eq('is_active', true)

      setSeasons(seasonsData || [])

      if (!seasonsData || seasonsData.length === 0) {
        const { data: newSeason } = await supabase
          .from('seasons')
          .insert([{
            team_id: membership.team_id,
            name: `Saison ${new Date().getFullYear()}`,
            start_date: new Date().toISOString().split('T')[0],
            is_active: true
          }])
          .select()
          .single()

        if (newSeason) {
          setSeasons([newSeason])
          setFormData(prev => ({ ...prev, seasonId: newSeason.id }))
        }
      } else {
        setFormData(prev => ({ ...prev, seasonId: seasonsData[0].id }))
      }

    } catch (err) {
      logger.error('Erreur:', err)
      setError("Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.opponent.trim()) {
      setError("Le nom de l'adversaire est obligatoire")
      return
    }
    if (!formData.matchDate) {
      setError("La date du match est obligatoire")
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const supabase = createClient()

      // 1. Créer le match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert([{
          season_id: formData.seasonId,
          opponent: formData.opponent,
          match_date: formData.matchDate,
          location: formData.location || null,
          status: 'scheduled'
        }])
        .select()
        .single()

      if (matchError) throw matchError

      // 2. Créer la session de vote
      const { data: session, error: sessionError } = await supabase
        .from('voting_sessions')
        .insert([{
          match_id: match.id,
          status: 'open',
          include_predictions: formData.enablePredictions,
          include_best_action: formData.enableBestMove,
          include_worst_action: false
        }])
        .select()
        .single()

      if (sessionError) throw sessionError

      setSuccess("Session de vote créée ! Les membres peuvent maintenant rejoindre depuis leur dashboard.")

      setTimeout(() => {
        router.push(`/vote/${session.id}/manage`)
      }, 1500)

    } catch (err: unknown) {
      logger.error('Erreur:', err)
      setError(
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: string }).message)
          : "Erreur lors de la création"
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Retour au dashboard</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">Créer un match & Vote</h1>
          <p className="text-gray-400 mb-8">Les membres de l&apos;équipe pourront rejoindre le vote depuis leur dashboard</p>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-400" size={20} />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="text-green-400" size={20} />
              <p className="text-green-300 text-sm">{success}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Informations du match */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Informations du match</h2>

              <div className="space-y-4">
                {seasons.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Saison</label>
                    <select
                      value={formData.seasonId}
                      onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                    >
                      {seasons.map(season => (
                        <option key={season.id} value={season.id}>{season.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Adversaire *</label>
                  <input
                    type="text"
                    value={formData.opponent}
                    onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                    placeholder="FC Exemple"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Date du match *</label>
                    <input
                      type="date"
                      value={formData.matchDate}
                      onChange={(e) => setFormData({ ...formData, matchDate: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Lieu (optionnel)</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                      placeholder="Stade municipal"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Fonctionnalités supplémentaires */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Fonctionnalités du vote</h2>
              <p className="text-sm text-gray-400 mb-4">Activez des options supplémentaires pour enrichir votre session de vote</p>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, enablePredictions: !formData.enablePredictions })}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    formData.enablePredictions
                      ? 'bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/30'
                      : 'bg-slate-700/30 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      formData.enablePredictions ? 'bg-purple-500' : 'bg-slate-600'
                    }`}>
                      <Target className="text-white" size={24} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Prédictions</p>
                      <p className="text-sm text-gray-400">Les joueurs peuvent prédire qui sera TOP et FLOP avant le vote</p>
                    </div>
                  </div>
                  <div className={`w-14 h-8 rounded-full relative transition-all ${
                    formData.enablePredictions ? 'bg-purple-500' : 'bg-slate-600'
                  }`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
                      formData.enablePredictions ? 'right-1' : 'left-1'
                    }`} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, enableBestMove: !formData.enableBestMove })}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    formData.enableBestMove
                      ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/30'
                      : 'bg-slate-700/30 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      formData.enableBestMove ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                      <Sparkles className="text-white" size={24} />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">Plus beau geste</p>
                      <p className="text-sm text-gray-400">Votez également pour le plus beau geste du match</p>
                    </div>
                  </div>
                  <div className={`w-14 h-8 rounded-full relative transition-all ${
                    formData.enableBestMove ? 'bg-amber-500' : 'bg-slate-600'
                  }`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${
                      formData.enableBestMove ? 'right-1' : 'left-1'
                    }`} />
                  </div>
                </button>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <Send size={20} />
                  <span>Créer et lancer le vote</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
