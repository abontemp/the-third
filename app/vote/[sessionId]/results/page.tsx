'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader, TrendingUp, TrendingDown, Sparkles, Flame, Trophy, Target } from 'lucide-react'

type PodiumResult = {
  player_id: string
  player_name: string
  vote_count: number
  percentage: number
}

type VotingSession = {
  id: string
  include_predictions: boolean
  include_best_action: boolean
  include_worst_action: boolean
  match: {
    opponent: string
    match_date: string
  }
}

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [allVotes, setAllVotes] = useState<any[]>([])
  const [topResults, setTopResults] = useState<PodiumResult[]>([])
  const [flopResults, setFlopResults] = useState<PodiumResult[]>([])
  const [bestActionResults, setBestActionResults] = useState<PodiumResult[]>([])
  const [worstActionResults, setWorstActionResults] = useState<PodiumResult[]>([])
  const [predictionStats, setPredictionStats] = useState<{
    top_correct: number
    flop_correct: number
    both_correct: number
    total_predictions: number
  }>({ top_correct: 0, flop_correct: 0, both_correct: 0, total_predictions: 0 })

  useEffect(() => {
    loadResults()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadResults = async () => {
    try {
      setLoading(true)

      // Récupérer la session
      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          include_predictions,
          include_best_action,
          include_worst_action,
          match:match_id(opponent, match_date)
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        alert('Session introuvable')
        router.push('/dashboard')
        return
      }

      const sessionFormatted: VotingSession = {
        id: sessionData.id,
        include_predictions: sessionData.include_predictions,
        include_best_action: sessionData.include_best_action,
        include_worst_action: sessionData.include_worst_action,
        match: Array.isArray(sessionData.match) ? sessionData.match[0] : sessionData.match
      }

      setSession(sessionFormatted)

      // Récupérer tous les votes
      const { data: votesData } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId)

      if (!votesData || votesData.length === 0) {
        setLoading(false)
        return
      }

      setAllVotes(votesData)

      // Récupérer tous les profils nécessaires
      const allPlayerIds = new Set<string>()
      votesData.forEach(vote => {
        allPlayerIds.add(vote.top_player_id)
        allPlayerIds.add(vote.flop_player_id)
        if (vote.best_action_player_id) allPlayerIds.add(vote.best_action_player_id)
        if (vote.worst_action_player_id) allPlayerIds.add(vote.worst_action_player_id)
      })

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, email')
        .in('id', Array.from(allPlayerIds))

      const getDisplayName = (userId: string) => {
        const profile = profilesData?.find(p => p.id === userId)
        if (!profile) return 'Inconnu'
        
        if (profile.nickname?.trim()) return profile.nickname.trim()
        if (profile.first_name || profile.last_name) {
          const firstName = profile.first_name?.trim() || ''
          const lastName = profile.last_name?.trim() || ''
          return `${firstName} ${lastName}`.trim()
        }
        if (profile.email) return profile.email
        return 'Inconnu'
      }

      // Calculer les résultats TOP
      const topVotes: Record<string, number> = {}
      votesData.forEach(vote => {
        topVotes[vote.top_player_id] = (topVotes[vote.top_player_id] || 0) + 1
      })
      const topSorted = Object.entries(topVotes)
        .map(([playerId, count]) => ({
          player_id: playerId,
          player_name: getDisplayName(playerId),
          vote_count: count,
          percentage: Math.round((count / votesData.length) * 100)
        }))
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 3)
      setTopResults(topSorted)

      // Calculer les résultats FLOP
      const flopVotes: Record<string, number> = {}
      votesData.forEach(vote => {
        flopVotes[vote.flop_player_id] = (flopVotes[vote.flop_player_id] || 0) + 1
      })
      const flopSorted = Object.entries(flopVotes)
        .map(([playerId, count]) => ({
          player_id: playerId,
          player_name: getDisplayName(playerId),
          vote_count: count,
          percentage: Math.round((count / votesData.length) * 100)
        }))
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 3)
      setFlopResults(flopSorted)

      // Calculer les résultats Plus beau geste
      if (sessionFormatted.include_best_action) {
        const bestActionVotes: Record<string, number> = {}
        votesData.forEach(vote => {
          if (vote.best_action_player_id) {
            bestActionVotes[vote.best_action_player_id] = (bestActionVotes[vote.best_action_player_id] || 0) + 1
          }
        })
        const bestActionSorted = Object.entries(bestActionVotes)
          .map(([playerId, count]) => ({
            player_id: playerId,
            player_name: getDisplayName(playerId),
            vote_count: count,
            percentage: Math.round((count / votesData.length) * 100)
          }))
          .sort((a, b) => b.vote_count - a.vote_count)
          .slice(0, 3)
        setBestActionResults(bestActionSorted)
      }

      // Calculer les résultats Plus beau fail
      if (sessionFormatted.include_worst_action) {
        const worstActionVotes: Record<string, number> = {}
        votesData.forEach(vote => {
          if (vote.worst_action_player_id) {
            worstActionVotes[vote.worst_action_player_id] = (worstActionVotes[vote.worst_action_player_id] || 0) + 1
          }
        })
        const worstActionSorted = Object.entries(worstActionVotes)
          .map(([playerId, count]) => ({
            player_id: playerId,
            player_name: getDisplayName(playerId),
            vote_count: count,
            percentage: Math.round((count / votesData.length) * 100)
          }))
          .sort((a, b) => b.vote_count - a.vote_count)
          .slice(0, 3)
        setWorstActionResults(worstActionSorted)
      }

      // Calculer les stats des prédictions
      if (sessionFormatted.include_predictions && topSorted.length > 0 && flopSorted.length > 0) {
        const topWinner = topSorted[0].player_id
        const flopWinner = flopSorted[0].player_id
        
        let topCorrect = 0
        let flopCorrect = 0
        let bothCorrect = 0
        let totalPredictions = 0

        votesData.forEach(vote => {
          if (vote.predicted_top_id && vote.predicted_flop_id) {
            totalPredictions++
            const isTopCorrect = vote.predicted_top_id === topWinner
            const isFlopCorrect = vote.predicted_flop_id === flopWinner
            
            if (isTopCorrect) topCorrect++
            if (isFlopCorrect) flopCorrect++
            if (isTopCorrect && isFlopCorrect) bothCorrect++
          }
        })

        setPredictionStats({
          top_correct: topCorrect,
          flop_correct: flopCorrect,
          both_correct: bothCorrect,
          total_predictions: totalPredictions
        })
      }

    } catch (err) {
      console.error('Erreur chargement résultats:', err)
      alert('Erreur lors du chargement des résultats')
    } finally {
      setLoading(false)
    }
  }

  const getMedalColor = (index: number) => {
    if (index === 0) return 'from-yellow-500 to-yellow-600'
    if (index === 1) return 'from-gray-400 to-gray-500'
    return 'from-orange-600 to-orange-700'
  }

  const getPodiumHeight = (index: number) => {
    if (index === 0) return 'h-48'
    if (index === 1) return 'h-40'
    return 'h-32'
  }

  const getPodiumOrder = (index: number) => {
    if (index === 0) return 'order-2'
    if (index === 1) return 'order-1'
    return 'order-3'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Session introuvable</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-purple-300 hover:text-purple-100 mb-6 flex items-center gap-2 transition"
        >
          <ArrowLeft size={20} />
          Retour au dashboard
        </button>

        {/* Header */}
        <div className="text-center mb-12">
          <Trophy className="text-yellow-400 mx-auto mb-4" size={64} />
          <h1 className="text-4xl font-bold text-white mb-2">Résultats du match</h1>
          <p className="text-xl text-gray-300">
            Contre <span className="font-semibold text-purple-300">{session.match.opponent}</span>
          </p>
          <p className="text-gray-400">
            {new Date(session.match.match_date).toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        <div className="space-y-12">
          {/* Stats des prédictions */}
          {session.include_predictions && predictionStats.total_predictions > 0 && (
            <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/30 rounded-2xl p-8">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Target className="text-purple-400" size={32} />
                <h2 className="text-3xl font-bold text-white">Précision des prédictions</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-700/30 rounded-lg p-6 text-center">
                  <p className="text-gray-400 mb-2">Prédictions TOP correctes</p>
                  <p className="text-4xl font-bold text-green-400">
                    {predictionStats.top_correct}/{predictionStats.total_predictions}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {Math.round((predictionStats.top_correct / predictionStats.total_predictions) * 100)}% de réussite
                  </p>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-6 text-center">
                  <p className="text-gray-400 mb-2">Prédictions FLOP correctes</p>
                  <p className="text-4xl font-bold text-red-400">
                    {predictionStats.flop_correct}/{predictionStats.total_predictions}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    {Math.round((predictionStats.flop_correct / predictionStats.total_predictions) * 100)}% de réussite
                  </p>
                </div>

                <div className="bg-slate-700/30 rounded-lg p-6 text-center">
                  <p className="text-gray-400 mb-2">Prédictions parfaites</p>
                  <p className="text-4xl font-bold text-purple-400">
                    {predictionStats.both_correct}/{predictionStats.total_predictions}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    TOP et FLOP corrects
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Podium TOP */}
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <TrendingUp className="text-green-400" size={32} />
              <h2 className="text-3xl font-bold text-white">Top du match</h2>
            </div>

            {topResults.length > 0 ? (
              <div className="flex items-end justify-center gap-4 mb-8">
                {topResults.map((result, index) => (
                  <div
                    key={result.player_id}
                    className={`flex flex-col items-center ${getPodiumOrder(index)}`}
                    style={{ width: '200px' }}
                  >
                    {/* Médaille */}
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(index)} flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg`}>
                      {index + 1}
                    </div>

                    {/* Nom et stats */}
                    <div className="bg-slate-800/50 rounded-lg p-4 w-full text-center mb-4">
                      <p className="font-bold text-white text-lg mb-2">{result.player_name}</p>
                      <p className="text-green-400 text-2xl font-bold">{result.vote_count} votes</p>
                      <p className="text-gray-400 text-sm">{result.percentage}%</p>
                    </div>

                    {/* Colonne du podium */}
                    <div className={`w-full ${getPodiumHeight(index)} bg-gradient-to-t ${getMedalColor(index)} rounded-t-xl flex items-center justify-center transition-all duration-500`}>
                      <span className="text-white font-bold text-4xl">{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400">Aucun vote enregistré</p>
            )}
          </div>

          {/* Podium FLOP */}
          <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <TrendingDown className="text-red-400" size={32} />
              <h2 className="text-3xl font-bold text-white">Flop du match</h2>
            </div>

            {flopResults.length > 0 ? (
              <div className="flex items-end justify-center gap-4 mb-8">
                {flopResults.map((result, index) => (
                  <div
                    key={result.player_id}
                    className={`flex flex-col items-center ${getPodiumOrder(index)}`}
                    style={{ width: '200px' }}
                  >
                    {/* Médaille */}
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(index)} flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg`}>
                      {index + 1}
                    </div>

                    {/* Nom et stats */}
                    <div className="bg-slate-800/50 rounded-lg p-4 w-full text-center mb-4">
                      <p className="font-bold text-white text-lg mb-2">{result.player_name}</p>
                      <p className="text-red-400 text-2xl font-bold">{result.vote_count} votes</p>
                      <p className="text-gray-400 text-sm">{result.percentage}%</p>
                    </div>

                    {/* Colonne du podium */}
                    <div className={`w-full ${getPodiumHeight(index)} bg-gradient-to-t ${getMedalColor(index)} rounded-t-xl flex items-center justify-center transition-all duration-500`}>
                      <span className="text-white font-bold text-4xl">{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400">Aucun vote enregistré</p>
            )}
          </div>

          {/* Podium Plus beau geste */}
          {session.include_best_action && bestActionResults.length > 0 && (
            <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-2xl p-8">
              <div className="flex items-center justify-center gap-3 mb-8">
                <Sparkles className="text-blue-400" size={32} />
                <h2 className="text-3xl font-bold text-white">Plus beau geste</h2>
              </div>

              <div className="flex items-end justify-center gap-4 mb-8">
                {bestActionResults.map((result, index) => (
                  <div
                    key={result.player_id}
                    className={`flex flex-col items-center ${getPodiumOrder(index)}`}
                    style={{ width: '200px' }}
                  >
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(index)} flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg`}>
                      {index + 1}
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 w-full text-center mb-4">
                      <p className="font-bold text-white text-lg mb-2">{result.player_name}</p>
                      <p className="text-blue-400 text-2xl font-bold">{result.vote_count} votes</p>
                      <p className="text-gray-400 text-sm">{result.percentage}%</p>
                    </div>
                    <div className={`w-full ${getPodiumHeight(index)} bg-gradient-to-t ${getMedalColor(index)} rounded-t-xl flex items-center justify-center transition-all duration-500`}>
                      <span className="text-white font-bold text-4xl">{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Podium Plus beau fail */}
          {session.include_worst_action && worstActionResults.length > 0 && (
            <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-orange-500/30 rounded-2xl p-8">
              <div className="flex items-center justify-center gap-3 mb-8">
                <Flame className="text-orange-400" size={32} />
                <h2 className="text-3xl font-bold text-white">Plus beau fail</h2>
              </div>

              <div className="flex items-end justify-center gap-4 mb-8">
                {worstActionResults.map((result, index) => (
                  <div
                    key={result.player_id}
                    className={`flex flex-col items-center ${getPodiumOrder(index)}`}
                    style={{ width: '200px' }}
                  >
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(index)} flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg`}>
                      {index + 1}
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 w-full text-center mb-4">
                      <p className="font-bold text-white text-lg mb-2">{result.player_name}</p>
                      <p className="text-orange-400 text-2xl font-bold">{result.vote_count} votes</p>
                      <p className="text-gray-400 text-sm">{result.percentage}%</p>
                    </div>
                    <div className={`w-full ${getPodiumHeight(index)} bg-gradient-to-t ${getMedalColor(index)} rounded-t-xl flex items-center justify-center transition-all duration-500`}>
                      <span className="text-white font-bold text-4xl">{index + 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}