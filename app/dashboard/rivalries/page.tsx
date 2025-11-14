'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Swords, Heart, Target } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type RivalryData = {
  player_id: string
  player_name: string
  avatar_url?: string
  flop_votes_given: number
}

type SupporterData = {
  supporter_id: string
  supporter_name: string
  avatar_url?: string
  top_votes_given: number
}

type DuelData = {
  player1_id: string
  player1_name: string
  player1_avatar?: string
  player2_id: string
  player2_name: string
  player2_avatar?: string
  player1_votes_to_2: number
  player2_votes_to_1: number
}

export default function RivalriesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [myName, setMyName] = useState<string>('')
  
  const [myRivals, setMyRivals] = useState<RivalryData[]>([])
  const [mySupporters, setMySupporters] = useState<SupporterData[]>([])
  const [topDuels, setTopDuels] = useState<DuelData[]>([])

  useEffect(() => {
    loadRivalriesData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRivalriesData = async () => {
    try {
      setLoading(true)
      console.log('🔍 Chargement des rivalités...')
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      console.log('✅ Utilisateur trouvé:', user.id)

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

      // Récupérer l'équipe sélectionnée depuis le localStorage
      const selectedTeamId = localStorage.getItem('selectedTeamId')
      
      if (!selectedTeamId) {
        console.log('❌ Pas d\'équipe sélectionnée')
        router.push('/dashboard')
        return
      }

      // Récupérer mon équipe
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('team_id', selectedTeamId)
        .maybeSingle()

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

      // Récupérer tous les votes
      const { data: allVotes } = await supabase
        .from('votes')
        .select('voter_id, top_player_id, flop_player_id')
        .in('session_id', sessionIds)

      if (!allVotes || allVotes.length === 0) {
        console.log('❌ Aucun vote trouvé')
        setLoading(false)
        return
      }
      console.log(`✅ ${allVotes.length} votes trouvés`)

      // Récupérer tous les profils
      const allUserIds = new Set<string>()
      allVotes.forEach(v => {
        if (v.voter_id) allUserIds.add(v.voter_id)
        if (v.top_player_id) allUserIds.add(v.top_player_id)
        if (v.flop_player_id) allUserIds.add(v.flop_player_id)
      })

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, avatar_url')
        .in('id', Array.from(allUserIds))

      const profilesMap: Record<string, { name: string; avatar_url?: string }> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = {
          name: p.nickname || 
                (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8)),
          avatar_url: p.avatar_url
        }
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
          player_name: profilesMap[playerId]?.name || 'Inconnu',
          avatar_url: profilesMap[playerId]?.avatar_url,
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
          supporter_name: profilesMap[supporterId]?.name || 'Inconnu',
          avatar_url: profilesMap[supporterId]?.avatar_url,
          top_votes_given: count
        }))
        .sort((a, b) => b.top_votes_given - a.top_votes_given)
        .slice(0, 5)

      setMySupporters(supportersArray)

      // 3. Calculer les DUELS de l'équipe (votes FLOP croisés)
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
            
            // Minimum 3 votes échangés pour être considéré comme un duel
            if (votes1to2 + votes2to1 >= 3) {
              duelsArray.push({
                player1_id: player1,
                player1_name: profilesMap[player1]?.name || 'Inconnu',
                player1_avatar: profilesMap[player1]?.avatar_url,
                player2_id: player2,
                player2_name: profilesMap[player2]?.name || 'Inconnu',
                player2_avatar: profilesMap[player2]?.avatar_url,
                player1_votes_to_2: votes1to2,
                player2_votes_to_1: votes2to1
              })
              
              processedPairs.add(pairKey1)
              processedPairs.add(pairKey2)
            }
          }
        })
      })

      // Trier par intensité totale du duel
      duelsArray.sort((a, b) => 
        (b.player1_votes_to_2 + b.player2_votes_to_1) - (a.player1_votes_to_2 + a.player2_votes_to_1)
      )

      setTopDuels(duelsArray.slice(0, 5))
      console.log('✅ Rivalités chargées avec succès')

    } catch (error) {
      console.error('❌ Erreur lors du chargement des rivalités:', error)
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
          <h1 className="text-3xl font-bold text-white">⚔️ Rivalités & Duels</h1>
        </div>

        {/* Mes Rivaux */}
        <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="text-red-400" size={32} />
            <h2 className="text-2xl font-bold text-white">🎯 Mes Rivaux</h2>
          </div>
          <p className="text-gray-300 mb-4 text-sm">
            Joueurs qui ont le plus voté FLOP contre {myName}
          </p>
          
          {myRivals.length > 0 ? (
            <div className="space-y-3">
              {myRivals.map((rival, index) => (
                <div key={rival.player_id} className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-red-400">#{index + 1}</span>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center overflow-hidden">
                      {rival.avatar_url ? (
                        <img src={rival.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">
                          {rival.player_name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-semibold">{rival.player_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 text-xl font-bold">{rival.flop_votes_given}</p>
                    <p className="text-gray-400 text-xs">votes FLOP</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Personne ne vous a encore voté FLOP... Vous êtes intouchable ! 🛡️</p>
          )}
        </div>

        {/* Mes Supporters */}
        <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Heart className="text-green-400" size={32} />
            <h2 className="text-2xl font-bold text-white">💚 Mes Supporters</h2>
          </div>
          <p className="text-gray-300 mb-4 text-sm">
            Joueurs qui ont le plus voté TOP pour {myName}
          </p>
          
          {mySupporters.length > 0 ? (
            <div className="space-y-3">
              {mySupporters.map((supporter, index) => (
                <div key={supporter.supporter_id} className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-xl font-bold text-green-400">#{index + 1}</span>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center overflow-hidden">
                      {supporter.avatar_url ? (
                        <img src={supporter.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold">
                          {supporter.supporter_name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-white font-semibold">{supporter.supporter_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 text-xl font-bold">{supporter.top_votes_given}</p>
                    <p className="text-gray-400 text-xs">votes TOP</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Personne ne vous a encore voté TOP... Patience ! 🌟</p>
          )}
        </div>

        {/* Top Duels de l'Équipe */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Swords className="text-purple-400" size={32} />
            <h2 className="text-2xl font-bold text-white">⚔️ Top Duels de l&apos;Équipe</h2>
          </div>
          <p className="text-gray-400 mb-6 text-sm">
            Les rivalités les plus intenses (votes FLOP croisés)
          </p>
          
          {topDuels.length === 0 ? (
            <p className="text-gray-400">Pas encore de duels significatifs dans l&apos;équipe...</p>
          ) : (
            <div className="space-y-4">
              {topDuels.map((duel, index) => (
                <div key={`${duel.player1_id}-${duel.player2_id}`} className="bg-slate-700/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-bold text-purple-400">#{index + 1}</span>
                    <Swords className="text-purple-400" size={28} />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                        {duel.player1_avatar ? (
                          <img src={duel.player1_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-lg">
                            {duel.player1_name[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-white font-bold text-lg mb-2">{duel.player1_name}</p>
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2">
                        <p className="text-red-400 text-2xl font-bold">{duel.player1_votes_to_2}</p>
                        <p className="text-gray-400 text-xs">FLOP donnés</p>
                      </div>
                    </div>

                    <div className="px-6">
                      <div className="text-gray-500 text-3xl font-bold">VS</div>
                    </div>

                    <div className="text-center flex-1">
                      <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center overflow-hidden">
                        {duel.player2_avatar ? (
                          <img src={duel.player2_avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-lg">
                            {duel.player2_name[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-white font-bold text-lg mb-2">{duel.player2_name}</p>
                      <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2">
                        <p className="text-red-400 text-2xl font-bold">{duel.player2_votes_to_1}</p>
                        <p className="text-gray-400 text-xs">FLOP donnés</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-center">
                    <p className="text-gray-500 text-sm">
                      Intensité : <span className="text-white font-semibold">
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