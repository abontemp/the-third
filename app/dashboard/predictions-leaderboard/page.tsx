'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Sparkles, Trophy, Medal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type PlayerPredictionStats = {
  user_id: string
  player_name: string
  total_predictions: number
  top_correct: number
  flop_correct: number
  total_correct: number
  accuracy_percentage: number
}

export default function PredictionsLeaderboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<PlayerPredictionStats[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)

  useEffect(() => {
    loadLeaderboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeaderboard = async () => {
    try {
      console.log('🔍 Chargement du classement des pronostiqueurs...')
      setLoading(true)
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('❌ Erreur auth:', userError)
        router.push('/login')
        return
      }

      console.log('✅ Utilisateur trouvé:', user.id)

      const { data: membership, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (membershipError || !membership) {
        console.error('⚠️ Erreur membership:', membershipError)
        setLoading(false)
        return
      }

      console.log('✅ Équipe trouvée:', membership.team_id)

      const { data: currentSeason } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', membership.team_id)
        .eq('is_active', true)
        .single()

      if (!currentSeason) {
        console.log('⚠️ Pas de saison active')
        setLoading(false)
        return
      }

      console.log('✅ Saison active:', currentSeason.id)

      // Récupérer tous les votes avec prédictions pour cette saison
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select(`
          user_id,
          predicted_top_id,
          predicted_flop_id,
          voting_sessions!inner(
            id,
            top_player_id,
            flop_player_id,
            matches!inner(
              season_id
            )
          )
        `)
        .eq('voting_sessions.matches.season_id', currentSeason.id)
        .not('predicted_top_id', 'is', null)
        .not('predicted_flop_id', 'is', null)

      if (votesError) {
        console.error('⚠️ Erreur votes:', votesError)
        setLoading(false)
        return
      }

      console.log('✅ Votes avec prédictions récupérés:', votesData?.length || 0)

      if (!votesData || votesData.length === 0) {
        setLeaderboard([])
        setLoading(false)
        return
      }

      // Calculer les stats par joueur
      const statsMap: Record<string, {
        total: number
        topCorrect: number
        flopCorrect: number
      }> = {}

      votesData.forEach(vote => {
        if (!statsMap[vote.user_id]) {
          statsMap[vote.user_id] = { total: 0, topCorrect: 0, flopCorrect: 0 }
        }

        statsMap[vote.user_id].total++

        const sessionData = Array.isArray(vote.voting_sessions) 
          ? vote.voting_sessions[0] 
          : vote.voting_sessions

        if (vote.predicted_top_id === sessionData?.top_player_id) {
          statsMap[vote.user_id].topCorrect++
        }

        if (vote.predicted_flop_id === sessionData?.flop_player_id) {
          statsMap[vote.user_id].flopCorrect++
        }
      })

      // Récupérer les profils
      const userIds = Object.keys(statsMap)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .in('id', userIds)

      const profilesMap: Record<string, string> = {}
      profilesData?.forEach(p => {
        profilesMap[p.id] = p.nickname || 
                           (p.first_name && p.last_name 
                             ? `${p.first_name} ${p.last_name}` 
                             : 'Joueur')
      })

      // Formater le classement
      const formattedLeaderboard = Object.entries(statsMap)
        .map(([userId, stats]) => {
          const totalCorrect = stats.topCorrect + stats.flopCorrect
          const maxPossible = stats.total * 2
          const accuracy = maxPossible > 0 ? (totalCorrect / maxPossible) * 100 : 0

          return {
            user_id: userId,
            player_name: profilesMap[userId] || 'Inconnu',
            total_predictions: stats.total,
            top_correct: stats.topCorrect,
            flop_correct: stats.flopCorrect,
            total_correct: totalCorrect,
            accuracy_percentage: accuracy
          }
        })
        .filter(p => p.total_predictions >= 3) // Minimum 3 prédictions
        .sort((a, b) => b.accuracy_percentage - a.accuracy_percentage)

      setLeaderboard(formattedLeaderboard)

      // Trouver mon rang
      const myIndex = formattedLeaderboard.findIndex(p => p.user_id === user.id)
      if (myIndex !== -1) {
        setMyRank(myIndex + 1)
      }

      console.log('✅ Classement créé:', formattedLeaderboard.length, 'joueurs')

    } catch (err) {
      console.error('❌ Erreur générale:', err)
    } finally {
      setLoading(false)
      console.log('✅ Chargement terminé')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="text-white animate-spin mx-auto mb-4" size={48} />
          <p className="text-gray-400">Chargement du classement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Retour au dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles size={24} />
              Classement des Pronostiqueurs
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {leaderboard.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Sparkles className="mx-auto mb-4 text-gray-600" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Pas encore de pronostiqueurs</h2>
            <p className="text-gray-400">
              Les joueurs doivent faire au moins 3 prédictions pour apparaître dans le classement
            </p>
          </div>
        ) : (
          <>
            {/* Podium - Top 3 */}
            {leaderboard.length >= 3 && (
              <div className="mb-12">
                <h2 className="text-3xl font-bold text-white text-center mb-8">🏆 Podium des Oracles</h2>
                <div className="flex items-end justify-center gap-4">
                  {/* 2ème place */}
                  <div className="flex flex-col items-center">
                    <div className="bg-gradient-to-br from-gray-400 to-gray-600 p-1 rounded-full mb-3">
                      <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-2xl">
                        2
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-700/30 to-gray-800/30 border border-gray-500/30 rounded-xl p-4 text-center w-48">
                      <Medal className="text-gray-400 mx-auto mb-2" size={32} />
                      <p className="font-bold text-white mb-1">{leaderboard[1].player_name}</p>
                      <p className="text-2xl font-bold text-gray-400 mb-1">
                        {leaderboard[1].accuracy_percentage.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {leaderboard[1].total_correct}/{leaderboard[1].total_predictions * 2} correct
                      </p>
                    </div>
                  </div>

                  {/* 1ère place */}
                  <div className="flex flex-col items-center -mt-8">
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-1 rounded-full mb-3">
                      <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-3xl">
                        1
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-xl p-6 text-center w-56">
                      <Trophy className="text-yellow-400 mx-auto mb-3" size={48} />
                      <p className="font-bold text-white text-lg mb-2">{leaderboard[0].player_name}</p>
                      <p className="text-4xl font-bold text-yellow-400 mb-2">
                        {leaderboard[0].accuracy_percentage.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-400">
                        {leaderboard[0].total_correct}/{leaderboard[0].total_predictions * 2} correct
                      </p>
                    </div>
                  </div>

                  {/* 3ème place */}
                  <div className="flex flex-col items-center">
                    <div className="bg-gradient-to-br from-orange-600 to-red-600 p-1 rounded-full mb-3">
                      <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-2xl">
                        3
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-700/30 to-red-700/30 border border-orange-500/30 rounded-xl p-4 text-center w-48">
                      <Medal className="text-orange-400 mx-auto mb-2" size={32} />
                      <p className="font-bold text-white mb-1">{leaderboard[2].player_name}</p>
                      <p className="text-2xl font-bold text-orange-400 mb-1">
                        {leaderboard[2].accuracy_percentage.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {leaderboard[2].total_correct}/{leaderboard[2].total_predictions * 2} correct
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Classement complet */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6">
              <h3 className="text-2xl font-bold text-white mb-6">Classement Complet</h3>
              <div className="space-y-3">
                {leaderboard.map((player, index) => (
                  <div 
                    key={player.user_id}
                    className={`bg-slate-700/30 border rounded-lg p-4 flex items-center gap-4 ${
                      index + 1 === myRank ? 'border-purple-500/50 bg-purple-900/20' : 'border-white/10'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                      index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                      index === 2 ? 'bg-gradient-to-br from-orange-600 to-red-600' :
                      'bg-gradient-to-br from-blue-500 to-purple-500'
                    }`}>
                      #{index + 1}
                    </div>

                    <div className="flex-1">
                      <p className="font-bold text-white text-lg">{player.player_name}</p>
                      <p className="text-sm text-gray-400">
                        {player.total_predictions} prédiction{player.total_predictions > 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-400">
                        {player.accuracy_percentage.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {player.total_correct}/{player.total_predictions * 2}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {myRank && (
              <div className="mt-6 bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6 text-center">
                <Sparkles className="text-purple-400 mx-auto mb-3" size={32} />
                <p className="text-gray-400 mb-1">Votre position</p>
                <p className="text-4xl font-bold text-white">#{myRank}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}