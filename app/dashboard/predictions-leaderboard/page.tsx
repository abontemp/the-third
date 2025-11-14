'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Trophy, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

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
  const [myStats, setMyStats] = useState<PlayerPredictionStats | null>(null)

  useEffect(() => {
    loadLeaderboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadLeaderboard = async () => {
    try {
      setLoading(true)
      console.log('🔍 Chargement du classement...')
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      console.log('✅ Utilisateur trouvé:', user.id)

      // Récupérer mon équipe
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        console.log('❌ Pas de membership trouvé')
        return
      }
      console.log('✅ Équipe trouvée:', membership.team_id)

      // Récupérer tous les matchs de l'équipe
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .eq('team_id', membership.team_id)

      const matchIds = matches?.map(m => m.id) || []
      console.log(`✅ ${matchIds.length} matchs trouvés`)

      if (matchIds.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer toutes les sessions de vote
      const { data: sessions } = await supabase
        .from('voting_sessions')
        .select('id')
        .in('match_id', matchIds)

      const sessionIds = sessions?.map(s => s.id) || []
      console.log(`✅ ${sessionIds.length} sessions trouvées`)

      if (sessionIds.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer toutes les prédictions
      const { data: predictions } = await supabase
        .from('predictions')
        .select('user_id, top_correct, flop_correct')
        .in('session_id', sessionIds)

      if (!predictions || predictions.length === 0) {
        console.log('❌ Aucune prédiction trouvée')
        setLeaderboard([])
        setLoading(false)
        return
      }
      console.log(`✅ ${predictions.length} prédictions trouvées`)

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
      if (myIndex >= 0) {
        setMyRank(myIndex + 1)
        setMyStats(leaderboardData[myIndex])
      }

      console.log('✅ Classement chargé avec succès')

    } catch (error) {
      console.error('❌ Erreur lors du chargement du classement:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-white" size={48} />
      </div>
    )
  }

  const podium = leaderboard.slice(0, 3)
  const restOfLeaderboard = leaderboard.slice(3)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <ArrowLeft className="text-white" size={24} />
          </button>
          <h1 className="text-3xl font-bold text-white">🔮 Classement des Pronostiqueurs</h1>
        </div>

        {/* Ma position */}
        {myStats && myRank && (
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
                  {myStats.avatar_url ? (
                    <img src={myStats.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold">
                      {myStats.player_name[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white font-bold">Votre position</p>
                  <p className="text-purple-300 text-sm">
                    {myStats.total_predictions} prédiction{myStats.total_predictions > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-white">#{myRank}</p>
                <p className="text-purple-300 text-lg">{myStats.accuracy_percentage}%</p>
              </div>
            </div>
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-8 text-center">
            <Target className="mx-auto mb-4 text-gray-400" size={64} />
            <p className="text-gray-400 text-lg">
              Aucune prédiction n&apos;a encore été faite !
            </p>
            <p className="text-gray-500 text-sm mt-2">
              Le classement apparaîtra dès que les joueurs auront fait au moins 3 prédictions.
            </p>
          </div>
        ) : (
          <>
            {/* Podium */}
            {podium.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Trophy className="text-yellow-400" size={28} />
                  Podium
                </h2>
                
                <div className="flex items-end justify-center gap-4 mb-8">
                  {/* 2ème place */}
                  {podium[1] && (
                    <div className="flex-1 max-w-[200px]">
                      <div className="bg-gradient-to-br from-gray-300 to-gray-500 rounded-t-2xl p-4 text-center">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white flex items-center justify-center overflow-hidden">
                          {podium[1].avatar_url ? (
                            <img src={podium[1].avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-gray-700 font-bold text-xl">
                              {podium[1].player_name[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-white font-bold text-lg mb-1">{podium[1].player_name}</p>
                        <p className="text-white text-2xl font-bold">{podium[1].accuracy_percentage}%</p>
                        <p className="text-white/80 text-xs">{podium[1].total_correct}/{podium[1].total_predictions * 2}</p>
                      </div>
                      <div className="bg-gray-400 h-24 rounded-b-2xl flex items-center justify-center">
                        <span className="text-4xl font-bold text-white">2</span>
                      </div>
                    </div>
                  )}

                  {/* 1ère place */}
                  {podium[0] && (
                    <div className="flex-1 max-w-[200px]">
                      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-t-2xl p-4 text-center">
                        <Trophy className="mx-auto mb-2 text-white" size={32} />
                        <div className="w-20 h-20 mx-auto mb-3 rounded-full bg-white flex items-center justify-center overflow-hidden">
                          {podium[0].avatar_url ? (
                            <img src={podium[0].avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-yellow-700 font-bold text-2xl">
                              {podium[0].player_name[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-white font-bold text-xl mb-1">{podium[0].player_name}</p>
                        <p className="text-white text-3xl font-bold">{podium[0].accuracy_percentage}%</p>
                        <p className="text-white/90 text-sm">{podium[0].total_correct}/{podium[0].total_predictions * 2}</p>
                      </div>
                      <div className="bg-yellow-500 h-32 rounded-b-2xl flex items-center justify-center">
                        <span className="text-5xl font-bold text-white">1</span>
                      </div>
                    </div>
                  )}

                  {/* 3ème place */}
                  {podium[2] && (
                    <div className="flex-1 max-w-[200px]">
                      <div className="bg-gradient-to-br from-orange-600 to-orange-800 rounded-t-2xl p-4 text-center">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white flex items-center justify-center overflow-hidden">
                          {podium[2].avatar_url ? (
                            <img src={podium[2].avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-orange-700 font-bold text-xl">
                              {podium[2].player_name[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-white font-bold text-lg mb-1">{podium[2].player_name}</p>
                        <p className="text-white text-2xl font-bold">{podium[2].accuracy_percentage}%</p>
                        <p className="text-white/80 text-xs">{podium[2].total_correct}/{podium[2].total_predictions * 2}</p>
                      </div>
                      <div className="bg-orange-700 h-16 rounded-b-2xl flex items-center justify-center">
                        <span className="text-4xl font-bold text-white">3</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reste du classement */}
            {restOfLeaderboard.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-white mb-4">Classement complet</h2>
                <div className="space-y-2">
                  {restOfLeaderboard.map((player, index) => (
                    <div 
                      key={player.user_id} 
                      className="bg-slate-700/30 border border-white/5 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center font-bold text-gray-300">
                          {index + 4}
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
                        <p className="text-gray-400 text-sm">
                          {player.total_correct}/{player.total_predictions * 2} correct
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}