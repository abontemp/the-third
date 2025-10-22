'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trophy, ArrowRight, SkipForward, Loader } from 'lucide-react'

export default function PredictionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([])
  const [topPrediction, setTopPrediction] = useState('')
  const [flopPrediction, setFlopPrediction] = useState('')
  const [matchInfo, setMatchInfo] = useState<{ opponent: string; date: string } | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')

  useEffect(() => {
    loadPredictionData()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPredictionData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          matches (
            id,
            opponent,
            match_date,
            team_id
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData || sessionData.status !== 'open') {
        router.push('/dashboard')
        return
      }

      const match = Array.isArray(sessionData.matches) 
        ? sessionData.matches[0] 
        : sessionData.matches

      setMatchInfo({
        opponent: match?.opponent || '',
        date: match?.match_date || ''
      })

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('team_id', match.team_id)
        .eq('status', 'accepted')

      const playersList = teamMembers?.map((member: {
        user_id: string
        profiles: {
          id: string
          first_name: string | null
          last_name: string | null
          email: string | null
        } | {
          id: string
          first_name: string | null
          last_name: string | null
          email: string | null
        }[]
      }) => {
        const profile = Array.isArray(member.profiles) 
          ? member.profiles[0] 
          : member.profiles

        if (!profile) {
          return {
            id: member.user_id,
            name: 'Joueur inconnu'
          }
        }

        return {
          id: profile.id,
          name: profile.first_name && profile.last_name
            ? `${profile.first_name} ${profile.last_name}`
            : profile.email || 'Joueur inconnu'
        }
      }) || []

      setPlayers(playersList)

      const { data: existingPrediction } = await supabase
        .from('predictions')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (existingPrediction) {
        setTopPrediction(existingPrediction.top_prediction || '')
        setFlopPrediction(existingPrediction.flop_prediction || '')
      }

      setLoading(false)
    } catch (error) {
      console.error('Erreur:', error)
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)

      if (topPrediction && flopPrediction) {
        const { data: existingPrediction } = await supabase
          .from('predictions')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', currentUserId)
          .single()

        if (existingPrediction) {
          await supabase
            .from('predictions')
            .update({
              top_prediction: topPrediction,
              flop_prediction: flopPrediction,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPrediction.id)
        } else {
          await supabase
            .from('predictions')
            .insert({
              session_id: sessionId,
              user_id: currentUserId,
              top_prediction: topPrediction,
              flop_prediction: flopPrediction
            })
        }
      }

      // Redirection vers la page de vote
      router.push(`/vote/${sessionId}`)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de l\'enregistrement de la prédiction')
      setSubmitting(false)
    }
  }

  const handleSkip = () => {
    // Redirection vers la page de vote (pas le dashboard)
    router.push(`/vote/${sessionId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">🔮 Vos prédictions</h1>
          {matchInfo && (
            <p className="text-gray-400">
              {matchInfo.opponent} - {new Date(matchInfo.date).toLocaleDateString('fr-FR')}
            </p>
          )}
          <p className="text-gray-300 mt-4">
            Avant de voter, faites vos prédictions sur qui sera le TOP et le FLOP du match !
          </p>
        </div>

        <div className="space-y-6">
          {/* Prédiction TOP */}
          <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-yellow-400" size={32} />
              <h2 className="text-2xl font-bold text-white">Prédiction TOP</h2>
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">
                Qui sera le meilleur joueur du match ?
              </label>
              <select
                value={topPrediction}
                onChange={(e) => setTopPrediction(e.target.value)}
                className="w-full bg-slate-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-yellow-500 focus:ring-2 focus:ring-yellow-500/20"
              >
                <option value="">-- Choisir un joueur --</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Prédiction FLOP */}
          <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <Trophy className="text-purple-400" size={32} />
              <h2 className="text-2xl font-bold text-white">Prédiction FLOP</h2>
            </div>

            <div>
              <label className="block text-gray-300 mb-2 font-semibold">
                Qui sera le moins bon joueur du match ?
              </label>
              <select
                value={flopPrediction}
                onChange={(e) => setFlopPrediction(e.target.value)}
                className="w-full bg-slate-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">-- Choisir un joueur --</option>
                {players.map(player => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-4">
            <button
              onClick={handleSkip}
              disabled={submitting}
              className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition"
            >
              <SkipForward size={20} />
              <span>Passer cette étape</span>
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting || !topPrediction || !flopPrediction}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg"
            >
              {submitting ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <span>Continuer vers le vote</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}