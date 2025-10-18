'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Sparkles, Trophy, Medal } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Image from 'next/image'

type PlayerPredictionStats = {
  user_id: string
  player_name: string
  avatar_url?: string
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
  const [filter, setFilter] = useState<'season' | 'all'>('season')

  useEffect(() => {
    loadLeaderboard()
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer l'équipe
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        router.push('/dashboard')
        return
      }

      // Récupérer la saison en cours
      const { data: currentSeason } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', membership.team_id)
        .eq('is_current', true)
        .single()

      // Récupérer toutes les saisons si "all"
      let seasonIds: string[] = []
      if (filter === 'season' && currentSeason) {
        seasonIds = [currentSeason.id]
      } else {
        const { data: allSeasons } = await supabase
          .from('seasons')
          .select('id')
          .eq('team_id', membership.team_id)
        seasonIds = allSeasons?.map(s => s.id) || []
      }

      if (seasonIds.length === 0) {
        setLeaderboard([])
        setLoading(false)
        return
      }

      // Récupérer tous les matchs
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .in('season_id', seasonIds)

      const matchIds = matches?.map(m => m.id) || []

      if (matchIds.length === 0) {
        setLeaderboard([])
        setLoading(false)
        return
      }

      // Récupérer toutes les sessions de vote terminées
      const { data: sessions } = await supabase
        .from('voting_sessions')
        .select('id')
        .in('match_id', matchIds)
        .eq('status', 'completed')

      const sessionIds = sessions?.map(s => s.id) || []

      if (sessionIds.length === 0) {
        setLeaderboard([])
        setLoading(false)
        return
      }

      // Récupérer toutes les prédictions
      const { data: predictions } = await supabase
        .from('predictions')
        .select('user_id, top_correct, flop_correct')
        .in('session_id', sessionIds)

      if (!predictions || predictions.length === 0) {
        setLeaderboard([])
        setLoading(false)
        return
      }

      // Calculer les stats par joueur
      const playerStats: Record<string, {
        total_predictions: number
        top_correct: number
        flop_correct: number
        total_correct: number
      }> = {}

      predictions.forEach(pred => {
        if (!playerStats[pred.user_id]) {
          playerStats[pred.user_id] = {
            total_predictions: 0,
            top_correct: 0,
            flop_correct: 0,
            total_correct: 0
          }
        }
        
        playerStats[pred.user_id].total_predictions += 1
        
        if (pred.top_correct) {
          playerStats[pred.user_id].top_correct += 1
          playerStats[pred.user_id].total_correct += 1
        }
        
        if (pred.flop_correct) {
          playerStats[pred.user_id].flop_correct += 1
          playerStats[pred.user_id].total_correct += 1
        }
      })

      // Récupérer les profils
      const userIds = Object.keys(playerStats)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, avatar_url')
        .in('id', userIds)

      const profilesMap: Record<string, { name: string; avatar_url?: string }> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = {
          name: p.nickname || 
                (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8)),
          avatar_url: p.avatar_url
        }
      })

      // Créer le classement
      const leaderboardData: PlayerPredictionStats[] = Object.entries(playerStats)
        .map(([userId, stats]) => ({
          user_id: userId,
          player_name: profilesMap[userId]?.name || 'Inconnu',
          avatar_url: profilesMap[userId]?.avatar_url,
          total_predictions: stats.total_predictions,
          top_correct: stats.top_correct,
          flop_correct: stats.flop_correct,
          total_correct: stats.total_correct,
          accuracy_percentage: Math.round((stats.total_correct / (stats.total_predictions * 2)) * 100)
        }))
        .filter(p => p.total_predictions >= 3) // Minimum 3 prédictions pour être classé
        .sort((a, b) => {
          // Trier par pourcentage de réussite, puis par nombre total de bonnes prédictions
          if (b.accuracy_percentage === a.accuracy_percentage) {
            return b.total_correct - a.total_correct
          }
          return b.accuracy_percentage - a.accuracy_percentage
        })

      setLeaderboard(leaderboardData)

      // Trouver mon rang
      const myIndex = leaderboardData.findIndex(p => p.user_id === user.id)
      setMyRank(myIndex >= 0 ? myIndex + 1 : null)

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
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
        
        {/* Filtres */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setFilter('season')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              filter === 'season'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Saison en cours
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Toute l&apos;histoire
          </button>
        </div>

        {leaderboard.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Sparkles className="mx-auto mb-4 text-gray-600" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Pas encore de prédictions</h2>
            <p className="text-gray-400">
              Les joueurs doivent faire au moins 3 prédictions pour apparaître dans le classement
            </p>
          </div>
        ) : (
          <>
            {/* Podium (Top 3) */}
            {leaderboard.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-8 max-w-4xl mx-auto">
                {/* 2ème place */}
                <div className="flex flex-col items-center pt-12">
                  <div className="bg-gradient-to-br from-gray-400 to-gray-600 p-1 rounded-full mb-3">
                    <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                      {leaderboard[1].avatar_url ? (
                        <img src={leaderboard[1].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">
                          {leaderboard[1].player_name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Medal className="text-gray-400 mb-2" size={32} />
                  <p className="text-white font-bold text-center">{leaderboard[1].player_name}</p>
                  <p className="text-gray-400 text-2xl font-bold">{leaderboard[1].accuracy_percentage}%</p>
                  <p className="text-gray-500 text-sm">{leaderboard[1].total_correct}/{leaderboard[1].total_predictions * 2}</p>
                </div>

                {/* 1ère place */}
                <div className="flex flex-col items-center">
                  <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-1 rounded-full mb-3">
                    <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                      {leaderboard[0].avatar_url ? (
                        <img src={leaderboard[0].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-3xl font-bold">
                          {leaderboard[0].player_name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Trophy className="text-yellow-400 mb-2" size={40} />
                  <p className="text-white font-bold text-center text-lg">{leaderboard[0].player_name}</p>
                  <p className="text-yellow-400 text-3xl font-bold">{leaderboard[0].accuracy_percentage}%</p>
                  <p className="text-gray-500 text-sm">{leaderboard[0].total_correct}/{leaderboard[0].total_predictions * 2}</p>
                </div>

                {/* 3ème place */}
                <div className="flex flex-col items-center pt-16">
                  <div className="bg-gradient-to-br from-orange-600 to-red-600 p-1 rounded-full mb-3">
                    <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                      {leaderboard[2].avatar_url ? (
                        <img src={leaderboard[2].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-2xl font-bold">
                          {leaderboard[2].player_name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Medal className="text-orange-600 mb-2" size={28} />
                  <p className="text-white font-bold text-center">{leaderboard[2].player_name}</p>
                  <p className="text-gray-400 text-2xl font-bold">{leaderboard[2].accuracy_percentage}%</p>
                  <p className="text-gray-500 text-sm">{leaderboard[2].total_correct}/{leaderboard[2].total_predictions * 2}</p>
                </div>
              </div>
            )}

            {/* Classement complet */}
            <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Classement complet</h3>
              
              <div className="space-y-2">
                {leaderboard.map((player, index) => (
                  <div 
                    key={player.user_id}
                    className={`rounded-lg p-4 flex items-center justify-between ${
                      index < 3 
                        ? 'bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30'
                        : 'bg-slate-700/30 border border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-slate-600 text-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold">
                            {player.player_name[0].toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-white font-semibold">{player.player_name}</p>
                        <p className="text-gray-400 text-sm">
                          {player.total_predictions} prédiction{player.total_predictions > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`text-2xl font-bold ${
                        player.accuracy_percentage >= 75 ? 'text-green-400' :
                        player.accuracy_percentage >= 50 ? 'text-yellow-400' :
                        'text-gray-400'
                      }`}>
                        {player.accuracy_percentage}%
                      </p>
                      <p className="text-gray-500 text-sm">
                        {player.total_correct}/{player.total_predictions * 2} correctes
                      </p>
                      <p className="text-gray-600 text-xs">
                        TOP: {player.top_correct} | FLOP: {player.flop_correct}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mon rang */}
            {myRank && (
              <div className="mt-6 bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 text-center">
                <p className="text-blue-300">
                  Votre position : <span className="font-bold text-white">#{myRank}</span> sur {leaderboard.length} pronostiqueurs
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}