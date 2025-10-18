'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Swords, Heart, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type RivalryData = {
  player_id: string
  player_name: string
  flop_votes_given: number
}

type SupporterData = {
  supporter_id: string
  supporter_name: string
  top_votes_given: number
}

type DuelData = {
  player1_id: string
  player1_name: string
  player2_id: string
  player2_name: string
  player1_votes_to_2: number
  player2_votes_to_1: number
}

export default function RivalriesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  
  const [myRivals, setMyRivals] = useState<RivalryData[]>([])
  const [mySupporters, setMySupporters] = useState<SupporterData[]>([])
  const [topDuels, setTopDuels] = useState<DuelData[]>([])

  useEffect(() => {
    loadRivalriesData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRivalriesData = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUserId(user.id)

      // Récupérer mon profil
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, nickname')
        .eq('id', user.id)
        .single()

      const displayName = myProfile?.nickname || 
                         (myProfile?.first_name && myProfile?.last_name 
                           ? `${myProfile.first_name} ${myProfile.last_name}` 
                           : 'Vous')
      setMyName(displayName)

      // Récupérer mon équipe
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        router.push('/dashboard')
        return
      }

      // Récupérer toutes les saisons de l'équipe
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', membership.team_id)

      const seasonIds = seasons?.map(s => s.id) || []

      if (seasonIds.length === 0) {
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
        setLoading(false)
        return
      }

      // Récupérer toutes les sessions de vote
      const { data: sessions } = await supabase
        .from('voting_sessions')
        .select('id')
        .in('match_id', matchIds)

      const sessionIds = sessions?.map(s => s.id) || []

      if (sessionIds.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer tous les votes
      const { data: allVotes } = await supabase
        .from('votes')
        .select('voter_id, top_player_id, flop_player_id')
        .in('session_id', sessionIds)

      if (!allVotes || allVotes.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer tous les profils
      const allUserIds = new Set<string>()
      allVotes.forEach(v => {
        if (v.voter_id) allUserIds.add(v.voter_id)
        if (v.top_player_id) allUserIds.add(v.top_player_id)
        if (v.flop_player_id) allUserIds.add(v.flop_player_id)
      })

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .in('id', Array.from(allUserIds))

      const profilesMap: Record<string, string> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = p.nickname || 
                           (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8))
      })

      // 1. Calculer MES RIVAUX (qui vote le plus FLOP contre moi)
      const flopVotesAgainstMe: Record<string, number> = {}
      allVotes.forEach(vote => {
        if (vote.flop_player_id === user.id && vote.voter_id !== user.id) {
          flopVotesAgainstMe[vote.voter_id] = (flopVotesAgainstMe[vote.voter_id] || 0) + 1
        }
      })

      const rivalsArray = Object.entries(flopVotesAgainstMe)
        .map(([playerId, count]) => ({
          player_id: playerId,
          player_name: profilesMap[playerId] || 'Inconnu',
          flop_votes_given: count
        }))
        .sort((a, b) => b.flop_votes_given - a.flop_votes_given)
        .slice(0, 5)

      setMyRivals(rivalsArray)

      // 2. Calculer MES SUPPORTERS (qui vote le plus TOP pour moi)
      const topVotesForMe: Record<string, number> = {}
      allVotes.forEach(vote => {
        if (vote.top_player_id === user.id && vote.voter_id !== user.id) {
          topVotesForMe[vote.voter_id] = (topVotesForMe[vote.voter_id] || 0) + 1
        }
      })

      const supportersArray = Object.entries(topVotesForMe)
        .map(([supporterId, count]) => ({
          supporter_id: supporterId,
          supporter_name: profilesMap[supporterId] || 'Inconnu',
          top_votes_given: count
        }))
        .sort((a, b) => b.top_votes_given - a.top_votes_given)
        .slice(0, 5)

      setMySupporters(supportersArray)

      // 3. Calculer les DUELS de l'équipe (votes croisés)
      const duelMatrix: Record<string, Record<string, number>> = {}
      
      allVotes.forEach(vote => {
        if (vote.voter_id && vote.flop_player_id && vote.voter_id !== vote.flop_player_id) {
          if (!duelMatrix[vote.voter_id]) {
            duelMatrix[vote.voter_id] = {}
          }
          duelMatrix[vote.voter_id][vote.flop_player_id] = 
            (duelMatrix[vote.voter_id][vote.flop_player_id] || 0) + 1
        }
      })

      const duelsArray: DuelData[] = []
      const processedPairs = new Set<string>()

      Object.keys(duelMatrix).forEach(player1 => {
        Object.keys(duelMatrix[player1]).forEach(player2 => {
          const pairKey1 = `${player1}-${player2}`
          const pairKey2 = `${player2}-${player1}`
          
          if (!processedPairs.has(pairKey1) && !processedPairs.has(pairKey2)) {
            const votes1to2 = duelMatrix[player1]?.[player2] || 0
            const votes2to1 = duelMatrix[player2]?.[player1] || 0
            
            // Garder seulement les duels significatifs (au moins 2 votes dans chaque sens)
            if (votes1to2 >= 2 && votes2to1 >= 2) {
              duelsArray.push({
                player1_id: player1,
                player1_name: profilesMap[player1] || 'Inconnu',
                player2_id: player2,
                player2_name: profilesMap[player2] || 'Inconnu',
                player1_votes_to_2: votes1to2,
                player2_votes_to_1: votes2to1
              })
              
              processedPairs.add(pairKey1)
              processedPairs.add(pairKey2)
            }
          }
        })
      })

      // Trier par intensité du duel (total des votes)
      duelsArray.sort((a, b) => 
        (b.player1_votes_to_2 + b.player2_votes_to_1) - (a.player1_votes_to_2 + a.player2_votes_to_1)
      )

      setTopDuels(duelsArray.slice(0, 5))

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
              <Swords size={24} />
              Rivalités & Duels
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Mes Rivaux */}
        <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Target className="text-red-400" size={40} />
            <div>
              <h2 className="text-3xl font-bold text-white">Mes Rivaux</h2>
              <p className="text-gray-400 text-sm">Ceux qui vous votent le plus en FLOP</p>
            </div>
          </div>

          {myRivals.length === 0 ? (
            <p className="text-gray-400">Aucune rivalité détectée pour le moment...</p>
          ) : (
            <div className="space-y-3">
              {myRivals.map((rival, index) => (
                <div key={rival.player_id} className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-red-600' : 'bg-slate-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{rival.player_name}</p>
                      <p className="text-red-400 text-sm">
                        {rival.flop_votes_given} vote{rival.flop_votes_given > 1 ? 's' : ''} FLOP contre vous
                      </p>
                    </div>
                  </div>
                  <Swords className="text-red-400" size={24} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mes Supporters */}
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Heart className="text-green-400" size={40} />
            <div>
              <h2 className="text-3xl font-bold text-white">Mes Plus Grands Fans</h2>
              <p className="text-gray-400 text-sm">Ceux qui vous votent le plus en TOP</p>
            </div>
          </div>

          {mySupporters.length === 0 ? (
            <p className="text-gray-400">Pas encore de supporters identifiés...</p>
          ) : (
            <div className="space-y-3">
              {mySupporters.map((supporter, index) => (
                <div key={supporter.supporter_id} className="bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      index === 0 ? 'bg-green-600' : 'bg-slate-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{supporter.supporter_name}</p>
                      <p className="text-green-400 text-sm">
                        {supporter.top_votes_given} vote{supporter.top_votes_given > 1 ? 's' : ''} TOP pour vous
                      </p>
                    </div>
                  </div>
                  <Heart className="text-green-400 fill-green-400" size={24} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Duels de l'équipe */}
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Swords className="text-purple-400" size={40} />
            <div>
              <h2 className="text-3xl font-bold text-white">Duels Légendaires</h2>
              <p className="text-gray-400 text-sm">Les plus grandes rivalités de l&apos;équipe</p>
            </div>
          </div>

          {topDuels.length === 0 ? (
            <p className="text-gray-400">Pas encore de duels significatifs dans l&apos;équipe...</p>
          ) : (
            <div className="space-y-4">
              {topDuels.map((duel, index) => (
                <div key={`${duel.player1_id}-${duel.player2_id}`} className="bg-slate-800/50 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-purple-400">#{index + 1}</span>
                    <Swords className="text-purple-400" size={28} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <p className="text-white font-bold text-lg mb-2">{duel.player1_name}</p>
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2">
                        <p className="text-red-400 text-2xl font-bold">{duel.player1_votes_to_2}</p>
                        <p className="text-gray-400 text-xs">votes FLOP donnés</p>
                      </div>
                    </div>

                    <div className="px-6">
                      <div className="text-gray-500 text-3xl font-bold">VS</div>
                    </div>

                    <div className="text-center flex-1">
                      <p className="text-white font-bold text-lg mb-2">{duel.player2_name}</p>
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2">
                        <p className="text-red-400 text-2xl font-bold">{duel.player2_votes_to_1}</p>
                        <p className="text-gray-400 text-xs">votes FLOP donnés</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="text-gray-500 text-sm">
                      Intensité du duel : <span className="text-white font-semibold">
                        {duel.player1_votes_to_2 + duel.player2_votes_to_1} votes FLOP échangés
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}