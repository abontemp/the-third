'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Trophy, ThumbsDown, Ghost, TrendingUp } from 'lucide-react'

type PlayerStats = {
  user_id: string
  player_name: string
  top_count: number
  flop_count: number
  total_votes: number
}

type StatsData = {
  masterTop: PlayerStats | null
  masterFlop: PlayerStats | null
  ghosts: PlayerStats[]
}

export default function StatsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [teamName, setTeamName] = useState('')
  const [currentSeasonId, setCurrentSeasonId] = useState<string | null>(null)
  const [view, setView] = useState<'season' | 'all'>('season')
  
  const [seasonStats, setSeasonStats] = useState<StatsData>({ masterTop: null, masterFlop: null, ghosts: [] })
  const [allTimeStats, setAllTimeStats] = useState<StatsData>({ masterTop: null, masterFlop: null, ghosts: [] })

  useEffect(() => {
    loadStats()
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer l'équipe
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) {
        return
      }

      const managerTeams = memberships.filter(m => 
        m.role === 'manager' || m.role === 'creator'
      )

      if (managerTeams.length === 0) {
        router.push('/dashboard')
        return
      }

      const teamId = managerTeams[0].team_id
      setSelectedTeam(teamId)

      // Récupérer le nom de l'équipe
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .single()

      if (teamData) {
        setTeamName(teamData.name)
      }

      // Récupérer toutes les saisons
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, name, is_current')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })

      const currentSeason = seasons?.find(s => s.is_current)
      setCurrentSeasonId(currentSeason?.id || null)

      // Charger les stats selon la vue
      if (view === 'season' && currentSeason) {
        await loadSeasonStats(currentSeason.id, teamId)
      } else {
        await loadAllTimeStats(teamId)
      }

    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSeasonStats = async (seasonId: string, teamId: string) => {
    // Récupérer les matchs de la saison
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .eq('season_id', seasonId)

    const matchIds = matches?.map(m => m.id) || []

    if (matchIds.length === 0) {
      setSeasonStats({ masterTop: null, masterFlop: null, ghosts: [] })
      return
    }

    await calculateStats(matchIds, teamId, 'season')
  }

  const loadAllTimeStats = async (teamId: string) => {
    // Récupérer toutes les saisons
    const { data: seasons } = await supabase
      .from('seasons')
      .select('id')
      .eq('team_id', teamId)

    const seasonIds = seasons?.map(s => s.id) || []

    if (seasonIds.length === 0) {
      setAllTimeStats({ masterTop: null, masterFlop: null, ghosts: [] })
      return
    }

    // Récupérer tous les matchs
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .in('season_id', seasonIds)

    const matchIds = matches?.map(m => m.id) || []

    if (matchIds.length === 0) {
      setAllTimeStats({ masterTop: null, masterFlop: null, ghosts: [] })
      return
    }

    await calculateStats(matchIds, teamId, 'all')
  }

  const calculateStats = async (matchIds: string[], teamId: string, statsType: 'season' | 'all') => {
    // Récupérer les sessions
    const { data: sessions } = await supabase
      .from('voting_sessions')
      .select('id')
      .in('match_id', matchIds)
      .eq('status', 'closed')

    const sessionIds = sessions?.map(s => s.id) || []

    if (sessionIds.length === 0) {
      const emptyStats = { masterTop: null, masterFlop: null, ghosts: [] }
      if (statsType === 'season') {
        setSeasonStats(emptyStats)
      } else {
        setAllTimeStats(emptyStats)
      }
      return
    }

    // Récupérer tous les votes
    const { data: votes } = await supabase
      .from('votes')
      .select('top_player_id, flop_player_id')
      .in('session_id', sessionIds)

    if (!votes) return

    // Compter les votes par joueur
    const playerVotes: Record<string, { top: number; flop: number }> = {}

    votes.forEach(vote => {
      if (vote.top_player_id) {
        if (!playerVotes[vote.top_player_id]) {
          playerVotes[vote.top_player_id] = { top: 0, flop: 0 }
        }
        playerVotes[vote.top_player_id].top++
      }

      if (vote.flop_player_id) {
        if (!playerVotes[vote.flop_player_id]) {
          playerVotes[vote.flop_player_id] = { top: 0, flop: 0 }
        }
        playerVotes[vote.flop_player_id].flop++
      }
    })

    // Récupérer tous les membres de l'équipe
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)

    const allMemberIds = members?.map(m => m.user_id) || []

    // Récupérer les noms
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', allMemberIds)

    const nameMap: Record<string, string> = {}
    profiles?.forEach(p => {
      nameMap[p.id] = p.first_name && p.last_name
        ? `${p.first_name} ${p.last_name}`
        : p.email || 'Joueur inconnu'
    })

    // Créer les stats par joueur
    const playerStatsList: PlayerStats[] = allMemberIds.map(userId => ({
      user_id: userId,
      player_name: nameMap[userId] || 'Joueur inconnu',
      top_count: playerVotes[userId]?.top || 0,
      flop_count: playerVotes[userId]?.flop || 0,
      total_votes: (playerVotes[userId]?.top || 0) + (playerVotes[userId]?.flop || 0)
    }))

    // Trouver le Master TOP
    const masterTop = playerStatsList.reduce((max, player) => 
      player.top_count > (max?.top_count || 0) ? player : max
    , playerStatsList[0] || null)

    // Trouver le Master FLOP
    const masterFlop = playerStatsList.reduce((max, player) => 
      player.flop_count > (max?.flop_count || 0) ? player : max
    , playerStatsList[0] || null)

    // Trouver les fantômes (aucun vote)
    const ghosts = playerStatsList.filter(p => p.total_votes === 0)

    const stats = {
      masterTop: masterTop && masterTop.top_count > 0 ? masterTop : null,
      masterFlop: masterFlop && masterFlop.flop_count > 0 ? masterFlop : null,
      ghosts
    }

    if (statsType === 'season') {
      setSeasonStats(stats)
    } else {
      setAllTimeStats(stats)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  const stats = view === 'season' ? seasonStats : allTimeStats

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

            <div>
              <h1 className="text-xl font-bold text-white">{teamName} - Statistiques</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sélecteur de vue */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setView('season')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              view === 'season'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Saison en cours
          </button>
          <button
            onClick={() => setView('all')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              view === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Toute la vie de l&apos;équipe
          </button>
        </div>

        {/* Master TOP */}
        <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="text-yellow-400" size={40} />
            <h2 className="text-3xl font-bold text-white">Master TOP</h2>
          </div>
          {stats.masterTop ? (
            <div className="bg-slate-800/50 rounded-xl p-6">
              <p className="text-2xl font-bold text-white mb-2">{stats.masterTop.player_name}</p>
              <p className="text-yellow-400 text-4xl font-bold">{stats.masterTop.top_count} votes TOP</p>
              <p className="text-gray-400 text-sm mt-2">
                {stats.masterTop.flop_count} votes FLOP • {stats.masterTop.total_votes} votes au total
              </p>
            </div>
          ) : (
            <p className="text-gray-400">Aucun vote TOP enregistré</p>
          )}
        </div>

        {/* Master FLOP */}
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <ThumbsDown className="text-purple-400" size={40} />
            <h2 className="text-3xl font-bold text-white">Master FLOP</h2>
          </div>
          {stats.masterFlop ? (
            <div className="bg-slate-800/50 rounded-xl p-6">
              <p className="text-2xl font-bold text-white mb-2">{stats.masterFlop.player_name}</p>
              <p className="text-purple-400 text-4xl font-bold">{stats.masterFlop.flop_count} votes FLOP</p>
              <p className="text-gray-400 text-sm mt-2">
                {stats.masterFlop.top_count} votes TOP • {stats.masterFlop.total_votes} votes au total
              </p>
            </div>
          ) : (
            <p className="text-gray-400">Aucun vote FLOP enregistré</p>
          )}
        </div>

        {/* Fantômes */}
        <div className="bg-gradient-to-br from-slate-800/50 to-gray-900/50 border border-gray-500/30 rounded-2xl p-8">
          <div className="flex items-center gap-3 mb-4">
            <Ghost className="text-gray-400" size={40} />
            <h2 className="text-3xl font-bold text-white">Les Fantômes</h2>
          </div>
          <p className="text-gray-400 mb-4">Joueurs n&apos;ayant jamais reçu de vote</p>
          {stats.ghosts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {stats.ghosts.map((ghost) => (
                <div key={ghost.user_id} className="bg-slate-800/50 rounded-lg p-4 text-center">
                  <p className="text-white font-semibold">{ghost.player_name}</p>
                  <p className="text-gray-500 text-sm">👻 0 vote</p>
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