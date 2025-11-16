'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Swords, Heart, Target } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

type RivalryData = {
  player_id: string
  player_name: string
  player_avatar: string | null
  flop_votes_given: number
}

type SupporterData = {
  supporter_id: string
  supporter_name: string
  supporter_avatar: string | null
  top_votes_given: number
}

type DuelData = {
  player1_id: string
  player1_name: string
  player1_avatar: string | null
  player2_id: string
  player2_name: string
  player2_avatar: string | null
  player1_votes_to_2: number
  player2_votes_to_1: number
}

function RivalriesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [myRivals, setMyRivals] = useState<RivalryData[]>([])
  const [mySupporters, setMySupporters] = useState<SupporterData[]>([])
  const [topDuels, setTopDuels] = useState<DuelData[]>([])

  useEffect(() => {
    loadRivalriesData()
  }, [])

  async function loadRivalriesData() {
    try {
      // 1. Récupérer team_id depuis URL params
      let currentTeamId = searchParams.get('team_id')
      
      // 2. Fallback : localStorage
      if (!currentTeamId && typeof window !== 'undefined') {
        currentTeamId = localStorage.getItem('selectedTeamId')
      }
      
      // 3. Fallback : première équipe de l'utilisateur
      if (!currentTeamId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!membership) {
          router.push('/dashboard')
          return
        }
        
        currentTeamId = membership.team_id
      }

      setTeamId(currentTeamId)

      // Récupérer l'utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer toutes les saisons de l'équipe
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', currentTeamId)

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

      // Récupérer tous les profils (avec avatars)
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

      const profilesMap: Record<string, { name: string; avatar: string | null }> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = {
          name: p.nickname || 
                (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8)),
          avatar: p.avatar_url
        }
      })

      // 1. MES RIVAUX : ceux qui m'ont voté FLOP le plus souvent
      const rivalsCounts: Record<string, number> = {}
      allVotes.forEach(vote => {
        if (vote.flop_player_id === user.id && vote.voter_id !== user.id) {
          rivalsCounts[vote.voter_id] = (rivalsCounts[vote.voter_id] || 0) + 1
        }
      })

      const rivalsArray: RivalryData[] = Object.entries(rivalsCounts).map(([playerId, count]) => ({
        player_id: playerId,
        player_name: profilesMap[playerId]?.name || 'Inconnu',
        player_avatar: profilesMap[playerId]?.avatar || null,
        flop_votes_given: count
      }))

      rivalsArray.sort((a, b) => b.flop_votes_given - a.flop_votes_given)
      setMyRivals(rivalsArray.slice(0, 5))

      // 2. MES SUPPORTERS : ceux qui m'ont voté TOP le plus souvent
      const supportersCounts: Record<string, number> = {}
      allVotes.forEach(vote => {
        if (vote.top_player_id === user.id && vote.voter_id !== user.id) {
          supportersCounts[vote.voter_id] = (supportersCounts[vote.voter_id] || 0) + 1
        }
      })

      const supportersArray: SupporterData[] = Object.entries(supportersCounts).map(([supporterId, count]) => ({
        supporter_id: supporterId,
        supporter_name: profilesMap[supporterId]?.name || 'Inconnu',
        supporter_avatar: profilesMap[supporterId]?.avatar || null,
        top_votes_given: count
      }))

      supportersArray.sort((a, b) => b.top_votes_given - a.top_votes_given)
      setMySupporters(supportersArray.slice(0, 5))

      // 3. TOP DUELS : paires de joueurs avec le plus de votes FLOP croisés
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
                player1_name: profilesMap[player1]?.name || 'Inconnu',
                player1_avatar: profilesMap[player1]?.avatar || null,
                player2_id: player2,
                player2_name: profilesMap[player2]?.name || 'Inconnu',
                player2_avatar: profilesMap[player2]?.avatar || null,
                player1_votes_to_2: votes1to2,
                player2_votes_to_1: votes2to1
              })
              
              processedPairs.add(pairKey1)
              processedPairs.add(pairKey2)
            }
          }
        })
      })

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
              onClick={() => router.push(`/dashboard${teamId ? `?team_id=${teamId}` : ''}`)}
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
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center overflow-hidden">
                      {rival.player_avatar ? (
                        <img src={rival.player_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {rival.player_name[0].toUpperCase()}
                        </span>
                      )}
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
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center overflow-hidden">
                      {supporter.supporter_avatar ? (
                        <img src={supporter.supporter_avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {supporter.supporter_name[0].toUpperCase()}
                        </span>
                      )}
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

        {/* Top Duels de l'Équipe */}
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <Swords className="text-purple-400" size={40} />
            <div>
              <h2 className="text-3xl font-bold text-white">Top Duels de l&apos;Équipe</h2>
              <p className="text-gray-400 text-sm">Les rivalités les plus intenses</p>
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
                      <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden">
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

export default function RivalriesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    }>
      <RivalriesContent />
    </Suspense>
  )
}