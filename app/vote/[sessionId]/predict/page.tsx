'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Trophy, ThumbsDown, Sparkles } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'

type Player = {
  user_id: string
  display_name: string
  avatar_url?: string
  player_number?: number
}

export default function PredictionsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [matchInfo, setMatchInfo] = useState({ opponent: '', match_date: '' })
  const [hasPredicted, setHasPredicted] = useState(false)
  const [existingPrediction, setExistingPrediction] = useState<{
    predicted_top: string
    predicted_flop: string
  } | null>(null)
  
  const [prediction, setPrediction] = useState({
    predictedTop: '',
    predictedFlop: ''
  })

  useEffect(() => {
    loadPredictionData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPredictionData = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer les infos du match
      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          matches (
            opponent,
            match_date,
            season_id
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        alert('Session introuvable')
        router.push('/dashboard')
        return
      }

      const matchData = Array.isArray(sessionData.matches) 
        ? sessionData.matches[0] 
        : sessionData.matches

      setMatchInfo({
        opponent: matchData.opponent,
        match_date: matchData.match_date
      })

      // Récupérer les joueurs de l'équipe
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('team_id')
        .eq('id', matchData.season_id)
        .single()

      if (!seasonData) return

      const { data: membersData } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', seasonData.team_id)

      const userIds = membersData?.map(m => m.user_id) || []

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, avatar_url, player_number')
        .in('id', userIds)

      const formattedPlayers = profilesData?.map(p => ({
        user_id: p.id,
        display_name: p.nickname || 
                     (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8)),
        avatar_url: p.avatar_url,
        player_number: p.player_number
      })) || []

      setPlayers(formattedPlayers)

      // Vérifier si l'utilisateur a déjà fait une prédiction
      const { data: predictionData } = await supabase
        .from('predictions')
        .select('predicted_top_player_id, predicted_flop_player_id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (predictionData) {
        setHasPredicted(true)
        
        const topPlayer = formattedPlayers.find(p => p.user_id === predictionData.predicted_top_player_id)
        const flopPlayer = formattedPlayers.find(p => p.user_id === predictionData.predicted_flop_player_id)
        
        setExistingPrediction({
          predicted_top: topPlayer?.display_name || 'Joueur inconnu',
          predicted_flop: flopPlayer?.display_name || 'Joueur inconnu'
        })
      }

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!prediction.predictedTop || !prediction.predictedFlop) {
      alert('Veuillez sélectionner un TOP et un FLOP')
      return
    }

    if (prediction.predictedTop === prediction.predictedFlop) {
      alert('Vous ne pouvez pas prédire la même personne pour TOP et FLOP')
      return
    }

    try {
      setSubmitting(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('predictions')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          predicted_top_player_id: prediction.predictedTop,
          predicted_flop_player_id: prediction.predictedFlop
        })

      if (error) throw error

      alert('🔮 Prédiction enregistrée ! Rendez-vous après le vote pour voir si vous aviez raison !')
      router.push(`/vote/${sessionId}`)

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de l\'enregistrement de la prédiction')
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

  if (hasPredicted && existingPrediction) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => router.push(`/vote/${sessionId}`)}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition"
              >
                <ArrowLeft size={20} />
                <span>Aller voter</span>
              </button>
              <h1 className="text-xl font-bold text-white">Prédiction déjà faite</h1>
            </div>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8 text-center">
            <Sparkles className="mx-auto mb-4 text-yellow-400" size={48} />
            <h2 className="text-2xl font-bold text-white mb-4">Vous avez déjà fait votre prédiction !</h2>
            
            <div className="space-y-4 mt-6">
              <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-yellow-400 text-sm mb-1">Votre TOP prédit</p>
                <p className="text-white text-xl font-bold">🏆 {existingPrediction.predicted_top}</p>
              </div>
              
              <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-4">
                <p className="text-purple-400 text-sm mb-1">Votre FLOP prédit</p>
                <p className="text-white text-xl font-bold">👎 {existingPrediction.predicted_flop}</p>
              </div>
            </div>

            <p className="text-gray-400 mt-6 mb-4">
              Rendez-vous après le vote pour voir si vous aviez raison ! 🎯
            </p>

            <button
              onClick={() => router.push(`/vote/${sessionId}`)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Aller voter maintenant
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push(`/vote/${sessionId}`)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Passer la prédiction</span>
            </button>
            <h1 className="text-xl font-bold text-white">🔮 Prédictions</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
          
          <div className="text-center mb-8">
            <Sparkles className="mx-auto mb-4 text-yellow-400" size={48} />
            <h2 className="text-2xl font-bold text-white mb-2">Faites vos pronostics !</h2>
            <p className="text-gray-400">
              Match contre <span className="text-white font-semibold">{matchInfo.opponent}</span>
            </p>
            <p className="text-gray-500 text-sm">
              {new Date(matchInfo.match_date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>

          {/* Prédiction TOP */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
              <Trophy className="text-yellow-400" size={24} />
              Qui sera le TOP du match ?
            </label>
            <select
              value={prediction.predictedTop}
              onChange={(e) => setPrediction({ ...prediction, predictedTop: e.target.value })}
              className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
            >
              <option value="">Sélectionnez un joueur</option>
              {players.map((player) => (
                <option key={player.user_id} value={player.user_id}>
                  {player.player_number ? `#${player.player_number} - ` : ''}{player.display_name}
                </option>
              ))}
            </select>
          </div>

          {/* Prédiction FLOP */}
          <div className="mb-8">
            <label className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
              <ThumbsDown className="text-purple-400" size={24} />
              Qui sera le FLOP du match ?
            </label>
            <select
              value={prediction.predictedFlop}
              onChange={(e) => setPrediction({ ...prediction, predictedFlop: e.target.value })}
              className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
            >
              <option value="">Sélectionnez un joueur</option>
              {players.map((player) => (
                <option key={player.user_id} value={player.user_id}>
                  {player.player_number ? `#${player.player_number} - ` : ''}{player.display_name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-blue-300 text-sm">
              💡 <strong>Astuce :</strong> Vous gagnerez des points si vos prédictions sont correctes ! 
              Un classement des meilleurs pronostiqueurs est disponible.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !prediction.predictedTop || !prediction.predictedFlop}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader className="animate-spin" size={20} />
                Enregistrement...
              </>
            ) : (
              <>
                <Sparkles size={20} />
                Valider mes prédictions
              </>
            )}
          </button>

          <button
            onClick={() => router.push(`/vote/${sessionId}`)}
            className="w-full mt-3 text-gray-400 hover:text-white py-2 text-sm transition"
          >
            Passer cette étape →
          </button>
        </div>
      </div>
    </div>
  )
}