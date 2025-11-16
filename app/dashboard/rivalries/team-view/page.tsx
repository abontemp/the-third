'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Users, TrendingUp, TrendingDown } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

type PlayerVoteMatrix = {
  playerId: string
  playerName: string
  playerAvatar: string | null
  votesGiven: Record<string, number> // receiverId -> count
}

function TeamRivalriesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [isManager, setIsManager] = useState(false)
  
  const [topMatrix, setTopMatrix] = useState<PlayerVoteMatrix[]>([])
  const [flopMatrix, setFlopMatrix] = useState<PlayerVoteMatrix[]>([])
  const [allPlayers, setAllPlayers] = useState<Array<{ id: string; name: string; avatar: string | null }>>([])

  useEffect(() => {
    loadTeamRivalries()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTeamRivalries() {
    try {
      setLoading(true)
      
      // Récupérer l'utilisateur
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // 1. Récupérer team_id
      let currentTeamId = searchParams.get('team_id')
      
      if (!currentTeamId && typeof window !== 'undefined') {
        currentTeamId = localStorage.getItem('selectedTeamId')
      }
      
      if (!currentTeamId) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id, role')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!membership) {
          router.push('/dashboard')
          return
        }
        
        currentTeamId = membership.team_id
        
        // Vérifier si manager
        if (membership.role === 'manager' || membership.role === 'creator') {
          setIsManager(true)
        } else {
          // Rediriger les non-managers vers la vue normale
          router.push(`/dashboard/rivalries?team_id=${currentTeamId}`)
          return
        }
      } else {
        // Double vérification du rôle
        const { data: membershipCheck } = await supabase
          .from('team_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('team_id', currentTeamId)
          .single()

        if (!membershipCheck || (membershipCheck.role !== 'manager' && membershipCheck.role !== 'creator')) {
          router.push(`/dashboard/rivalries?team_id=${currentTeamId}`)
          return
        }
        
        setIsManager(true)
      }

      setTeamId(currentTeamId)

      // Récupérer toutes les saisons
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

      // Récupérer toutes les sessions
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
        .select('id, first_name, last_name, nickname, avatar_url')
        .in('id', Array.from(allUserIds))

      const profilesMap: Record<string, { name: string; avatar: string | null }> = {}
      const playersArray: Array<{ id: string; name: string; avatar: string | null }> = []

      profiles?.forEach(p => {
        const name = p.nickname || 
                    (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8))
        profilesMap[p.id] = {
          name,
          avatar: p.avatar_url
        }
        playersArray.push({
          id: p.id,
          name,
          avatar: p.avatar_url
        })
      })

      playersArray.sort((a, b) => a.name.localeCompare(b.name))
      setAllPlayers(playersArray)

      // Construire les matrices TOP et FLOP
      const topVoteMatrix: Record<string, Record<string, number>> = {}
      const flopVoteMatrix: Record<string, Record<string, number>> = {}

      // Initialiser les matrices
      playersArray.forEach(p => {
        topVoteMatrix[p.id] = {}
        flopVoteMatrix[p.id] = {}
      })

      // Remplir les matrices
      allVotes.forEach(vote => {
        // Votes TOP
        if (vote.voter_id && vote.top_player_id && vote.voter_id !== vote.top_player_id) {
          if (!topVoteMatrix[vote.voter_id]) topVoteMatrix[vote.voter_id] = {}
          topVoteMatrix[vote.voter_id][vote.top_player_id] = 
            (topVoteMatrix[vote.voter_id][vote.top_player_id] || 0) + 1
        }

        // Votes FLOP
        if (vote.voter_id && vote.flop_player_id && vote.voter_id !== vote.flop_player_id) {
          if (!flopVoteMatrix[vote.voter_id]) flopVoteMatrix[vote.voter_id] = {}
          flopVoteMatrix[vote.voter_id][vote.flop_player_id] = 
            (flopVoteMatrix[vote.voter_id][vote.flop_player_id] || 0) + 1
        }
      })

      // Convertir en format pour l'affichage
      const topMatrixArray: PlayerVoteMatrix[] = playersArray.map(p => ({
        playerId: p.id,
        playerName: p.name,
        playerAvatar: p.avatar,
        votesGiven: topVoteMatrix[p.id] || {}
      }))

      const flopMatrixArray: PlayerVoteMatrix[] = playersArray.map(p => ({
        playerId: p.id,
        playerName: p.name,
        playerAvatar: p.avatar,
        votesGiven: flopVoteMatrix[p.id] || {}
      }))

      setTopMatrix(topMatrixArray)
      setFlopMatrix(flopMatrixArray)

    } catch (err) {
      console.error('Erreur chargement team rivalries:', err)
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

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Accès réservé aux managers</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push(`/dashboard/rivalries${teamId ? `?team_id=${teamId}` : ''}`)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Vue personnelle</span>
            </button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={24} />
              Vue Manager - Rivalités Équipe
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Matrice des votes TOP */}
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="text-green-400" size={40} />
            <div>
              <h2 className="text-3xl font-bold text-white">Matrice des Votes TOP</h2>
              <p className="text-gray-400 text-sm">Qui vote TOP pour qui dans l&apos;équipe</p>
            </div>
          </div>

          {allPlayers.length === 0 ? (
            <p className="text-gray-400">Aucune donnée disponible</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-800/90 backdrop-blur-sm p-3 text-left text-white font-semibold border border-green-500/20">
                      Votant →<br />Reçoit ↓
                    </th>
                    {allPlayers.map(player => (
                      <th key={player.id} className="p-3 text-center bg-slate-800/50 border border-green-500/20">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center overflow-hidden">
                            {player.avatar ? (
                              <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-xs">
                                {player.name[0]?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <span className="text-white text-xs font-medium max-w-[80px] truncate">
                            {player.name}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPlayers.map(receiver => (
                    <tr key={receiver.id} className="hover:bg-slate-800/30 transition">
                      <td className="sticky left-0 z-10 bg-slate-800/90 backdrop-blur-sm p-3 border border-green-500/20">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {receiver.avatar ? (
                              <img src={receiver.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-xs">
                                {receiver.name[0]?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <span className="text-white font-medium text-sm">{receiver.name}</span>
                        </div>
                      </td>
                      {allPlayers.map(voter => {
                        const voteCount = topMatrix.find(m => m.playerId === voter.id)?.votesGiven[receiver.id] || 0
                        const isSelf = voter.id === receiver.id
                        
                        return (
                          <td 
                            key={voter.id} 
                            className={`p-3 text-center border border-green-500/20 ${
                              isSelf ? 'bg-slate-700/50' : 'bg-slate-800/30'
                            }`}
                          >
                            {isSelf ? (
                              <span className="text-gray-600 text-sm">-</span>
                            ) : voteCount > 0 ? (
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                voteCount >= 10 ? 'bg-green-600 text-white' :
                                voteCount >= 5 ? 'bg-green-700 text-white' :
                                'bg-green-800/50 text-green-300'
                              }`}>
                                {voteCount}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-sm">0</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Matrice des votes FLOP */}
        <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <TrendingDown className="text-red-400" size={40} />
            <div>
              <h2 className="text-3xl font-bold text-white">Matrice des Votes FLOP</h2>
              <p className="text-gray-400 text-sm">Qui vote FLOP pour qui dans l&apos;équipe</p>
            </div>
          </div>

          {allPlayers.length === 0 ? (
            <p className="text-gray-400">Aucune donnée disponible</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-800/90 backdrop-blur-sm p-3 text-left text-white font-semibold border border-red-500/20">
                      Votant →<br />Reçoit ↓
                    </th>
                    {allPlayers.map(player => (
                      <th key={player.id} className="p-3 text-center bg-slate-800/50 border border-red-500/20">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center overflow-hidden">
                            {player.avatar ? (
                              <img src={player.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-xs">
                                {player.name[0]?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <span className="text-white text-xs font-medium max-w-[80px] truncate">
                            {player.name}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPlayers.map(receiver => (
                    <tr key={receiver.id} className="hover:bg-slate-800/30 transition">
                      <td className="sticky left-0 z-10 bg-slate-800/90 backdrop-blur-sm p-3 border border-red-500/20">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {receiver.avatar ? (
                              <img src={receiver.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white font-bold text-xs">
                                {receiver.name[0]?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <span className="text-white font-medium text-sm">{receiver.name}</span>
                        </div>
                      </td>
                      {allPlayers.map(voter => {
                        const voteCount = flopMatrix.find(m => m.playerId === voter.id)?.votesGiven[receiver.id] || 0
                        const isSelf = voter.id === receiver.id
                        
                        return (
                          <td 
                            key={voter.id} 
                            className={`p-3 text-center border border-red-500/20 ${
                              isSelf ? 'bg-slate-700/50' : 'bg-slate-800/30'
                            }`}
                          >
                            {isSelf ? (
                              <span className="text-gray-600 text-sm">-</span>
                            ) : voteCount > 0 ? (
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                                voteCount >= 10 ? 'bg-red-600 text-white' :
                                voteCount >= 5 ? 'bg-red-700 text-white' :
                                'bg-red-800/50 text-red-300'
                              }`}>
                                {voteCount}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-sm">0</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Légende */}
        <div className="mt-6 bg-slate-800/50 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-3">📖 Légende</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">Lecture du tableau :</strong>
              </p>
              <ul className="text-gray-400 space-y-1">
                <li>• Lignes = Joueur qui <strong>reçoit</strong> le vote</li>
                <li>• Colonnes = Joueur qui <strong>donne</strong> le vote</li>
                <li>• Case grisée = On ne peut pas voter pour soi-même</li>
              </ul>
            </div>
            <div>
              <p className="text-gray-300 mb-2">
                <strong className="text-white">Intensité des couleurs :</strong>
              </p>
              <ul className="text-gray-400 space-y-1">
                <li>• <span className="text-green-300">Vert clair</span> / <span className="text-red-300">Rouge clair</span> = 1-4 votes</li>
                <li>• <span className="text-green-400">Vert moyen</span> / <span className="text-red-400">Rouge moyen</span> = 5-9 votes</li>
                <li>• <span className="text-green-500">Vert foncé</span> / <span className="text-red-500">Rouge foncé</span> = 10+ votes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TeamRivalriesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    }>
      <TeamRivalriesContent />
    </Suspense>
  )
}