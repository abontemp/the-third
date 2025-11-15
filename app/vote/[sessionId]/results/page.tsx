'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader, TrendingUp, TrendingDown, Sparkles, Flame, Trophy, Target, Mic } from 'lucide-react'

type PodiumResult = {
  player_id: string
  player_name: string
  vote_count: number
  percentage: number
  rank: number // Position réelle basée sur le nombre de votes (1, 2, 3...)
}

type VotingSession = {
  id: string
  status: string
  include_predictions: boolean
  include_best_action: boolean
  include_worst_action: boolean
  top_reader_id?: string
  flop_reader_id?: string
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
  const [topReaderName, setTopReaderName] = useState<string>('')
  const [flopReaderName, setFlopReaderName] = useState<string>('')
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
          status,
          include_predictions,
          include_best_action,
          include_worst_action,
          top_reader_id,
          flop_reader_id,
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
        status: sessionData.status,
        include_predictions: sessionData.include_predictions,
        include_best_action: sessionData.include_best_action,
        include_worst_action: sessionData.include_worst_action,
        top_reader_id: sessionData.top_reader_id,
        flop_reader_id: sessionData.flop_reader_id,
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
      
      // Ajouter les lecteurs
      if (sessionData.top_reader_id) allPlayerIds.add(sessionData.top_reader_id)
      if (sessionData.flop_reader_id) allPlayerIds.add(sessionData.flop_reader_id)

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

      // Récupérer les noms des lecteurs
      if (sessionData.top_reader_id) {
        setTopReaderName(getDisplayName(sessionData.top_reader_id))
      }
      if (sessionData.flop_reader_id) {
        setFlopReaderName(getDisplayName(sessionData.flop_reader_id))
      }

      // 🎯 NOUVELLE FONCTION : Assigner les rangs avec gestion des ex-aequo
      const assignRanks = (results: { player_id: string; player_name: string; vote_count: number; percentage: number }[]): PodiumResult[] => {
        let currentRank = 1
        return results.map((result, index) => {
          // Si ce n'est pas le premier et que le nombre de votes est différent du précédent, incrémenter le rang
          if (index > 0 && result.vote_count !== results[index - 1].vote_count) {
            currentRank = index + 1
          }
          return {
            ...result,
            rank: currentRank
          }
        })
      }

      // Calculer les résultats TOP avec rangs
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
      
      const topWithRanks = assignRanks(topSorted).filter(r => r.rank <= 3)
      setTopResults(topWithRanks)

      // Calculer les résultats FLOP avec rangs
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
      
      const flopWithRanks = assignRanks(flopSorted).filter(r => r.rank <= 3)
      setFlopResults(flopWithRanks)

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
        
        const bestActionWithRanks = assignRanks(bestActionSorted).filter(r => r.rank <= 3)
        setBestActionResults(bestActionWithRanks)
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
        
        const worstActionWithRanks = assignRanks(worstActionSorted).filter(r => r.rank <= 3)
        setWorstActionResults(worstActionWithRanks)
      }

      // Calculer les stats des prédictions
      if (sessionFormatted.include_predictions && topWithRanks.length > 0 && flopWithRanks.length > 0) {
        const topWinner = topWithRanks[0].player_id
        const flopWinner = flopWithRanks[0].player_id
        
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

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-500 to-yellow-600'
    if (rank === 2) return 'from-gray-400 to-gray-500'
    return 'from-orange-600 to-orange-700'
  }

  const getPodiumHeight = (rank: number) => {
    if (rank === 1) return 'h-48'
    if (rank === 2) return 'h-40'
    return 'h-32'
  }

  // 🎯 NOUVELLE FONCTION : Grouper les résultats par rang
  const groupByRank = (results: PodiumResult[]) => {
    const grouped: Record<number, PodiumResult[]> = {}
    results.forEach(result => {
      if (!grouped[result.rank]) {
        grouped[result.rank] = []
      }
      grouped[result.rank].push(result)
    })
    return grouped
  }

  // 🎯 NOUVEAU COMPOSANT : Podium avec ex-aequo
  const PodiumWithTies = ({ results, color }: { results: PodiumResult[], color: string }) => {
    const grouped = groupByRank(results)
    const ranks = Object.keys(grouped).map(Number).sort()

    return (
      <div className="flex items-end justify-center gap-4 mb-8">
        {ranks.map(rank => {
          const playersAtRank = grouped[rank]
          const podiumOrder = rank === 1 ? 'order-2' : rank === 2 ? 'order-1' : 'order-3'
          
          return (
            <div
              key={rank}
              className={`flex flex-col items-center ${podiumOrder}`}
              style={{ minWidth: playersAtRank.length > 1 ? `${200 * playersAtRank.length}px` : '200px' }}
            >
              {/* Médaille(s) */}
              <div className="flex gap-2 mb-4 justify-center">
                {playersAtRank.map((player) => (
                  <div
                    key={player.player_id}
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(rank)} flex items-center justify-center text-white font-bold text-2xl shadow-lg`}
                  >
                    {rank}
                  </div>
                ))}
              </div>

              {/* Noms et stats */}
              <div className="flex gap-2 mb-4 w-full">
                {playersAtRank.map((player) => (
                  <div
                    key={player.player_id}
                    className="bg-slate-800/50 rounded-lg p-4 flex-1 text-center"
                  >
                    <p className="font-bold text-white text-base mb-2 break-words">{player.player_name}</p>
                    <p className={`${color} text-2xl font-bold`}>{player.vote_count} votes</p>
                    <p className="text-gray-400 text-sm">{player.percentage}%</p>
                  </div>
                ))}
              </div>

              {/* Colonne du podium */}
              <div className={`w-full ${getPodiumHeight(rank)} bg-gradient-to-t ${getMedalColor(rank)} rounded-t-xl flex items-center justify-center transition-all duration-500`}>
                <span className="text-white font-bold text-4xl">{rank}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
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

        {/* 🎤 NOUVEAU : Lecteurs désignés */}
        {session.status === 'reading' && (topReaderName || flopReaderName) && (
          <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/40 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Mic className="text-purple-400" size={32} />
              <h2 className="text-2xl font-bold text-white">Lecteurs désignés</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {topReaderName && (
                <div className="bg-slate-800/50 rounded-xl p-6 text-center border-2 border-green-500/30">
                  <p className="text-gray-400 mb-2">Lecteur TOP</p>
                  <div className="flex items-center justify-center gap-3">
                    <TrendingUp className="text-green-400" size={24} />
                    <p className="text-2xl font-bold text-white">{topReaderName}</p>
                  </div>
                </div>
              )}
              {flopReaderName && (
                <div className="bg-slate-800/50 rounded-xl p-6 text-center border-2 border-red-500/30">
                  <p className="text-gray-400 mb-2">Lecteur FLOP</p>
                  <div className="flex items-center justify-center gap-3">
                    <TrendingDown className="text-red-400" size={24} />
                    <p className="text-2xl font-bold text-white">{flopReaderName}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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

          {/* Podium TOP avec ex-aequo */}
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <TrendingUp className="text-green-400" size={32} />
              <h2 className="text-3xl font-bold text-white">Top du match</h2>
            </div>

            {topResults.length > 0 ? (
              <PodiumWithTies results={topResults} color="text-green-400" />
            ) : (
              <p className="text-center text-gray-400">Aucun vote enregistré</p>
            )}
          </div>

          {/* Podium FLOP avec ex-aequo */}
          <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-2xl p-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <TrendingDown className="text-red-400" size={32} />
              <h2 className="text-3xl font-bold text-white">Flop du match</h2>
            </div>

            {flopResults.length > 0 ? (
              <PodiumWithTies results={flopResults} color="text-red-400" />
            ) : (
              <p className="text-center text-gray-400">Aucun vote enregistré</p>
            )}
          </div>

          {/* Podium Plus beau geste avec ex-aequo */}
          {session.include_best_action && bestActionResults.length > 0 && (
            <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-2xl p-8">
              <div className="flex items-center justify-center gap-3 mb-8">
                <Sparkles className="text-blue-400" size={32} />
                <h2 className="text-3xl font-bold text-white">Plus beau geste</h2>
              </div>

              <PodiumWithTies results={bestActionResults} color="text-blue-400" />
            </div>
          )}

          {/* Podium Plus beau fail avec ex-aequo */}
          {session.include_worst_action && worstActionResults.length > 0 && (
            <div className="bg-gradient-to-br from-orange-900/30 to-amber-900/30 border border-orange-500/30 rounded-2xl p-8">
              <div className="flex items-center justify-center gap-3 mb-8">
                <Flame className="text-orange-400" size={32} />
                <h2 className="text-3xl font-bold text-white">Plus beau fail</h2>
              </div>

              <PodiumWithTies results={worstActionResults} color="text-orange-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}