'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trophy, ThumbsDown, Ghost, Loader, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type PlayerStats = {
  user_id: string
  player_name: string
  avatar_url?: string
  top_count: number
  flop_count: number
  total_votes: number
}

export default function StatsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [masterTop, setMasterTop] = useState<PlayerStats | null>(null)
  const [masterFlop, setMasterFlop] = useState<PlayerStats | null>(null)
  const [ghosts, setGhosts] = useState<PlayerStats[]>([])
  const [allPlayers, setAllPlayers] = useState<PlayerStats[]>([])

  useEffect(() => {
    loadStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async () => {
    try {
      setLoading(true)
      console.log('🔍 Chargement des stats...')
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      console.log('✅ Utilisateur trouvé:', user.id)

      // Récupérer mon équipe
      const { data: membership, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (membershipError) {
        console.error('❌ Erreur membership:', membershipError)
      }

      if (!membership) {
        console.log('❌ Pas de membership trouvé')
        setLoading(false)
        return
      }
      console.log('✅ Équipe trouvée:', membership.team_id)

      // Récupérer toutes les saisons de l'équipe
      const { data: seasons, error: seasonsError } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', membership.team_id)

      if (seasonsError) {
        console.error('❌ Erreur seasons:', seasonsError)
      }

      const seasonIds = seasons?.map(s => s.id) || []
      console.log(`✅ ${seasonIds.length} saisons trouvées`)

      if (seasonIds.length === 0) {
        console.log('⚠️ Aucune saison trouvée pour cette équipe')
        setLoading(false)
        return
      }

      // Récupérer tous les matchs de ces saisons
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id')
        .in('season_id', seasonIds)

      if (matchesError) {
        console.error('❌ Erreur matches:', matchesError)
      }

      const matchIds = matches?.map(m => m.id) || []
      console.log(`✅ ${matchIds.length} matchs trouvés`)

      if (matchIds.length === 0) {
        console.log('⚠️ Aucun match trouvé pour ces saisons')
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
        .select('top_player_id, flop_player_id')
        .in('session_id', sessionIds)

      if (!allVotes || allVotes.length === 0) {
        console.log('❌ Aucun vote trouvé')
        setLoading(false)
        return
      }
      console.log(`✅ ${allVotes.length} votes trouvés`)

      // Récupérer tous les membres de l'équipe
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', membership.team_id)

      const allMemberIds = teamMembers?.map(m => m.user_id) || []

      // Récupérer tous les profils
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, avatar_url')
        .in('id', allMemberIds)

      const profilesMap: Record<string, { name: string; avatar_url?: string }> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = {
          name: p.nickname || 
                (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8)),
          avatar_url: p.avatar_url
        }
      })

      // Compter les votes TOP par joueur
      const topVotes: Record<string, number> = {}
      allVotes.forEach(vote => {
        if (vote.top_player_id) {
          topVotes[vote.top_player_id] = (topVotes[vote.top_player_id] || 0) + 1
        }
      })

      // Compter les votes FLOP par joueur
      const flopVotes: Record<string, number> = {}
      allVotes.forEach(vote => {
        if (vote.flop_player_id) {
          flopVotes[vote.flop_player_id] = (flopVotes[vote.flop_player_id] || 0) + 1
        }
      })

      // Créer les stats pour tous les joueurs
      const playersStats: PlayerStats[] = allMemberIds.map(memberId => ({
        user_id: memberId,
        player_name: profilesMap[memberId]?.name || 'Inconnu',
        avatar_url: profilesMap[memberId]?.avatar_url,
        top_count: topVotes[memberId] || 0,
        flop_count: flopVotes[memberId] || 0,
        total_votes: (topVotes[memberId] || 0) + (flopVotes[memberId] || 0)
      }))

      // Trier par nombre total de votes (pour l'affichage)
      playersStats.sort((a, b) => b.total_votes - a.total_votes)
      setAllPlayers(playersStats)

      // Trouver le Master TOP
      const topEntries = Object.entries(topVotes)
      if (topEntries.length > 0) {
        const [topPlayerId, topCount] = topEntries.reduce((max, curr) => 
          curr[1] > max[1] ? curr : max
        )
        setMasterTop({
          user_id: topPlayerId,
          player_name: profilesMap[topPlayerId]?.name || 'Inconnu',
          avatar_url: profilesMap[topPlayerId]?.avatar_url,
          top_count: topCount,
          flop_count: flopVotes[topPlayerId] || 0,
          total_votes: topCount + (flopVotes[topPlayerId] || 0)
        })
      }

      // Trouver le Master FLOP
      const flopEntries = Object.entries(flopVotes)
      if (flopEntries.length > 0) {
        const [flopPlayerId, flopCount] = flopEntries.reduce((max, curr) => 
          curr[1] > max[1] ? curr : max
        )
        setMasterFlop({
          user_id: flopPlayerId,
          player_name: profilesMap[flopPlayerId]?.name || 'Inconnu',
          avatar_url: profilesMap[flopPlayerId]?.avatar_url,
          top_count: topVotes[flopPlayerId] || 0,
          flop_count: flopCount,
          total_votes: (topVotes[flopPlayerId] || 0) + flopCount
        })
      }

      // Trouver les fantômes (n'ont jamais reçu de votes)
      const votedPlayerIds = new Set([
        ...Object.keys(topVotes),
        ...Object.keys(flopVotes)
      ])

      const ghostPlayers = allMemberIds
        .filter(memberId => !votedPlayerIds.has(memberId))
        .map(ghostId => ({
          user_id: ghostId,
          player_name: profilesMap[ghostId]?.name || 'Inconnu',
          avatar_url: profilesMap[ghostId]?.avatar_url,
          top_count: 0,
          flop_count: 0,
          total_votes: 0
        }))

      setGhosts(ghostPlayers)
      console.log('✅ Stats chargées avec succès')

    } catch (error) {
      console.error('❌ Erreur lors du chargement des stats:', error)
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

  const maxVotes = Math.max(...allPlayers.map(p => Math.max(p.top_count, p.flop_count)), 1)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <ArrowLeft className="text-white" size={24} />
          </button>
          <h1 className="text-3xl font-bold text-white">📊 Statistiques</h1>
        </div>

        {/* Masters TOP et FLOP - Côte à côte */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Master TOP */}
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="text-yellow-400" size={32} />
              <h2 className="text-2xl font-bold text-white">🏆 Master TOP</h2>
            </div>
            
            {masterTop ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center overflow-hidden">
                  {masterTop.avatar_url ? (
                    <img src={masterTop.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-2xl">
                      {masterTop.player_name[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white text-xl font-bold">{masterTop.player_name}</p>
                  <p className="text-yellow-300 text-lg">
                    {masterTop.top_count} vote{masterTop.top_count > 1 ? 's' : ''} TOP
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-300">Aucun vote TOP enregistré pour le moment</p>
            )}
          </div>

          {/* Master FLOP */}
          <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <ThumbsDown className="text-red-400" size={32} />
              <h2 className="text-2xl font-bold text-white">👎 Master FLOP</h2>
            </div>
            
            {masterFlop ? (
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center overflow-hidden">
                  {masterFlop.avatar_url ? (
                    <img src={masterFlop.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-2xl">
                      {masterFlop.player_name[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white text-xl font-bold">{masterFlop.player_name}</p>
                  <p className="text-red-300 text-lg">
                    {masterFlop.flop_count} vote{masterFlop.flop_count > 1 ? 's' : ''} FLOP
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-300">Aucun vote FLOP enregistré pour le moment</p>
            )}
          </div>
        </div>

        {/* Graphiques de tous les joueurs */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="text-blue-400" size={32} />
            <h2 className="text-2xl font-bold text-white">📊 Votes par joueur</h2>
          </div>

          <div className="space-y-4">
            {allPlayers.map(player => (
              <div key={player.user_id} className="bg-slate-700/30 border border-white/10 rounded-xl p-4">
                {/* Info joueur */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold">
                        {player.player_name[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{player.player_name}</p>
                    <p className="text-gray-400 text-sm">
                      {player.total_votes} vote{player.total_votes > 1 ? 's' : ''} au total
                    </p>
                  </div>
                </div>

                {/* Barres de votes */}
                <div className="space-y-2">
                  {/* Barre TOP */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-green-400 text-sm font-semibold flex items-center gap-1">
                        <Trophy size={14} />
                        TOP
                      </span>
                      <span className="text-green-400 text-sm font-bold">{player.top_count}</span>
                    </div>
                    <div className="w-full bg-slate-600/30 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(player.top_count / maxVotes) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Barre FLOP */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-red-400 text-sm font-semibold flex items-center gap-1">
                        <ThumbsDown size={14} />
                        FLOP
                      </span>
                      <span className="text-red-400 text-sm font-bold">{player.flop_count}</span>
                    </div>
                    <div className="w-full bg-slate-600/30 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-red-500 to-pink-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(player.flop_count / maxVotes) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fantômes */}
        {ghosts.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Ghost className="text-gray-400" size={32} />
              <h2 className="text-2xl font-bold text-white">👻 Les Fantômes</h2>
            </div>
            <p className="text-gray-400 mb-4 text-sm">
              Joueurs n&apos;ayant jamais reçu de votes TOP ou FLOP
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ghosts.map(ghost => (
                <div key={ghost.user_id} className="bg-slate-700/30 border border-white/10 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 flex items-center justify-center overflow-hidden">
                    {ghost.avatar_url ? (
                      <img src={ghost.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold">
                        {ghost.player_name[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-white font-semibold">{ghost.player_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}