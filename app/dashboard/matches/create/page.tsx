'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, AlertCircle, CheckCircle, Loader } from 'lucide-react'

type Season = {
  id: string
  name: string
  is_active: boolean
}

export default function CreateMatchPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [seasons, setSeasons] = useState<Season[]>([])
  
  const [formData, setFormData] = useState({
    seasonId: '',
    opponent: '',
    matchDate: '',
    location: ''
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

      // Récupérer l'équipe de l'utilisateur
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) {
        setError("Vous ne faites partie d'aucune équipe")
        router.push('/onboarding')
        return
      }

      const membership = memberships.find(m => m.role === 'creator' || m.role === 'manager') || memberships[0]

      if (membership.role !== 'creator' && membership.role !== 'manager') {
        setError("Vous devez être manager pour créer un match")
        return
      }

      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', membership.team_id)
        .single()

      // Charger les saisons actives
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('id, name, is_active')
        .eq('team_id', membership.team_id)
        .eq('is_active', true)

      setSeasons(seasonsData || [])

      // Si pas de saison, en créer une par défaut
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
      console.error('Erreur:', err)
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

      // Créer le match uniquement
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

      setSuccess("Match créé avec succès ! Redirection...")
      
      setTimeout(() => {
        router.push(`/dashboard/matches/${match.id}/vote/create`)
      }, 1500)

    } catch (err: unknown) {
      console.error('Erreur:', err)
      setError(err instanceof Error ? err.message : "Erreur lors de la création")
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
          <h1 className="text-3xl font-bold text-white mb-2">Créer un match</h1>
          <p className="text-gray-400 mb-8">Étape 1/2 : Informations du match</p>

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
            <div className="space-y-4">
              {seasons.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Saison
                  </label>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Adversaire *
                </label>
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date du match *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.matchDate}
                    onChange={(e) => setFormData({ ...formData, matchDate: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Lieu (optionnel)
                  </label>
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

            <button
              onClick={handleSubmit}
              disabled={submitting || !formData.opponent || !formData.matchDate}
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
                  <span>Créer le match et continuer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}