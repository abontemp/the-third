'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trophy, ThumbsDown, Ghost, Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type PlayerStats = {
  user_id: string
  player_name: string
  avatar_url?: string
  vote_count: number
}

export default function StatsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [masterTop, setMasterTop] = useState<PlayerStats | null>(null)
  const [masterFlop, setMasterFlop] = useState<PlayerStats | null>(null)
  const [ghosts, setGhosts] = useState<PlayerStats[]>([])

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
        .select('id, team_id')
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
          vote_count: topCount
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
          vote_count: flopCount
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
          vote_count: 0
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
          <h1 className="text-3xl font-bold text-white">📊 Statistiques</h1>
        </div>

        {/* Master TOP */}
        <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-6 mb-6">
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
                  {masterTop.vote_count} vote{masterTop.vote_count > 1 ? 's' : ''} TOP
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-300">Aucun vote TOP enregistré pour le moment</p>
          )}
        </div>

        {/* Master FLOP */}
        <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30 rounded-2xl p-6 mb-6">
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
                  {masterFlop.vote_count} vote{masterFlop.vote_count > 1 ? 's' : ''} FLOP
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-300">Aucun vote FLOP enregistré pour le moment</p>
          )}
        </div>

        {/* Fantômes */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Ghost className="text-gray-400" size={32} />
            <h2 className="text-2xl font-bold text-white">👻 Les Fantômes</h2>
          </div>
          <p className="text-gray-400 mb-4 text-sm">
            Joueurs n&apos;ayant jamais reçu de votes TOP ou FLOP
          </p>
          
          {ghosts.length > 0 ? (
            <div className="space-y-3">
              {ghosts.map(ghost => (
                <div key={ghost.user_id} className="bg-slate-700/30 border border-white/5 rounded-lg p-4 flex items-center gap-4">
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
          ) : (
            <p className="text-gray-400">Tous les joueurs ont reçu au moins un vote !</p>
          )}
        </div>
      </div>
    </div>
  )
}