'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  Plus, Loader, Users, History, BarChart3, Sparkles, 
  ArrowRight, Trophy, MessageSquareQuote, Swords, Target,
  Award, Calendar, TrendingUp, UserPlus, RefreshCw
} from 'lucide-react'

type Team = {
  id: string
  name: string
  sport: string
  description: string | null
  userRole: 'creator' | 'manager' | 'member'
  memberCount: number
  pendingRequests: number
}

type VotingSession = {
  id: string
  match_id: string
  status: 'pending' | 'in_progress' | 'reading' | 'completed'
  matches: {
    opponent: string
    match_date: string
    location: string | null
  }
}

type Member = {
  id: string
  user_id: string
  role: 'creator' | 'manager' | 'member'
  first_name: string | null
  last_name: string | null
  nickname: string | null
  email: string | null
  avatar_url: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [activeSessions, setActiveSessions] = useState<VotingSession[]>([])
  const [members, setMembers] = useState<Member[]>([])

  useEffect(() => {
    loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTeam) {
      loadTeamData()
    }
  }, [selectedTeam]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTeams = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer le profil utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, nickname')
        .eq('id', user.id)
        .single()

      const displayName = profile?.nickname || 
                         (profile?.first_name && profile?.last_name 
                           ? `${profile.first_name} ${profile.last_name}` 
                           : user.email?.split('@')[0] || 'Utilisateur')
      setCurrentUserName(displayName)

      // Récupérer les équipes de l'utilisateur
      const { data: memberships } = await supabase
        .from('team_members')
        .select(`
          role,
          team_id,
          teams (
            id,
            name,
            sport,
            description
          )
        `)
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) {
        router.push('/onboarding')
        return
      }

      const teamsData = await Promise.all(
        memberships.map(async (membership: any) => {
          const team = membership.teams

          // Compter les membres
          const { count: memberCount } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)

          // Compter les demandes en attente (seulement pour managers/créateurs)
          let pendingCount = 0
          if (membership.role === 'creator' || membership.role === 'manager') {
            const { count } = await supabase
              .from('join_requests')
              .select('*', { count: 'exact', head: true })
              .eq('team_id', team.id)
              .eq('status', 'pending')
            pendingCount = count || 0
          }

          return {
            id: team.id,
            name: team.name,
            sport: team.sport,
            description: team.description,
            userRole: membership.role,
            memberCount: memberCount || 0,
            pendingRequests: pendingCount
          }
        })
      )

      setTeams(teamsData)
      
      // Sélectionner automatiquement la première équipe
      if (teamsData.length > 0) {
        setSelectedTeam(teamsData[0])
      }

    } catch (error) {
      console.error('Erreur lors du chargement des équipes:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamData = async () => {
    if (!selectedTeam) return

    try {
      // Charger les sessions actives
      const { data: matches } = await supabase
        .from('matches')
        .select(`
          id,
          opponent,
          match_date,
          location,
          voting_sessions (
            id,
            status
          )
        `)
        .eq('team_id', selectedTeam.id)
        .order('match_date', { ascending: false })

      const sessions: VotingSession[] = []
      matches?.forEach((match: any) => {
        match.voting_sessions?.forEach((session: any) => {
          if (session.status !== 'completed') {
            sessions.push({
              id: session.id,
              match_id: match.id,
              status: session.status,
              matches: {
                opponent: match.opponent,
                match_date: match.match_date,
                location: match.location
              }
            })
          }
        })
      })
      setActiveSessions(sessions)

      // Charger les membres
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('id, user_id, role')
        .eq('team_id', selectedTeam.id)
        .order('role', { ascending: true })

      console.log('Team members raw:', teamMembers)
      console.log('Members error:', membersError)

      if (!teamMembers || teamMembers.length === 0) {
        console.log('No team members found')
        setMembers([])
        return
      }

      // Récupérer les profils séparément
      const userIds = teamMembers.map((m: any) => m.user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, email, avatar_url')
        .in('id', userIds)

      console.log('Profiles:', profiles)
      console.log('Profiles error:', profilesError)

      // Créer une map des profils
      const profilesMap: Record<string, any> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = p
      })

      // Combiner les données
      const membersData = teamMembers.map((m: any) => {
        const profile = profilesMap[m.user_id]
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          nickname: profile?.nickname || null,
          email: profile?.email || null,
          avatar_url: profile?.avatar_url || null
        }
      })

      console.log('Final members data:', membersData)
      setMembers(membersData)

    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return { text: 'En attente', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' }
      case 'in_progress': return { text: 'Vote en cours', color: 'bg-green-500/20 text-green-300 border-green-500/30' }
      case 'reading': return { text: 'Lecture', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' }
      default: return { text: status, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-white" size={48} />
      </div>
    )
  }

  // Si plusieurs équipes, permettre la sélection
  if (!selectedTeam && teams.length > 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Sélectionnez une équipe</h1>
            <p className="text-gray-400 mb-8">Choisissez l&apos;équipe dont vous voulez voir le dashboard</p>
            
            <div className="space-y-4">
              {teams.map(team => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className="w-full bg-slate-700/30 hover:bg-slate-700/50 border border-white/10 hover:border-blue-500/50 rounded-xl p-6 text-left transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition">
                      {team.name}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      team.userRole === 'creator' ? 'bg-yellow-500/20 text-yellow-300' :
                      team.userRole === 'manager' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-blue-500/20 text-blue-300'
                    }`}>
                      {team.userRole === 'creator' ? 'Créateur' :
                       team.userRole === 'manager' ? 'Manager' : 'Membre'}
                    </span>
                  </div>
                  {team.description && (
                    <p className="text-gray-400 text-sm mb-2">{team.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users size={16} />
                      {team.memberCount} membres
                    </span>
                    {team.pendingRequests > 0 && (
                      <span className="flex items-center gap-1 text-orange-400">
                        <UserPlus size={16} />
                        {team.pendingRequests} demande{team.pendingRequests > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isManager = selectedTeam && (selectedTeam.userRole === 'creator' || selectedTeam.userRole === 'manager')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-orange-500 rounded-lg flex items-center justify-center font-bold text-white">
                T3
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{selectedTeam?.name}</h1>
                <p className="text-xs text-gray-400">{selectedTeam?.sport}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/profile')}
                className="hidden sm:flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-lg border border-white/10 hover:border-blue-500/50 transition"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {currentUserName ? currentUserName[0].toUpperCase() : 'U'}
                </div>
                <span className="text-white text-sm font-medium">{currentUserName}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Section 1: Création de vote (Managers seulement) */}
        {isManager && (
          <div className="mb-8">
            <button
              onClick={() => router.push('/vote/setup')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 rounded-2xl font-bold text-lg transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3"
            >
              <Plus size={28} />
              Créer une nouvelle session de vote
            </button>
          </div>
        )}

        {/* Section 2: Sessions actives */}
        {activeSessions.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="text-blue-400" />
              Sessions de vote actives
            </h2>
            <div className="space-y-3">
              {activeSessions.map(session => {
                const statusInfo = getStatusLabel(session.status)
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      if (session.status === 'in_progress') {
                        router.push(`/vote/${session.id}`)
                      } else if (session.status === 'reading') {
                        router.push(`/vote/${session.id}/reading`)
                      }
                    }}
                    className="w-full bg-slate-700/30 hover:bg-slate-700/50 border border-white/10 hover:border-blue-500/50 rounded-xl p-4 text-left transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold group-hover:text-blue-400 transition">
                          vs {session.matches.opponent}
                        </p>
                        <p className="text-gray-400 text-sm">
                          {new Date(session.matches.match_date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                          {statusInfo.text}
                        </span>
                        <ArrowRight className="text-gray-400 group-hover:text-blue-400 transition" size={20} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Section 3: Statistiques et Fonctionnalités */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <TrendingUp className="text-green-400" />
            Statistiques & Fonctionnalités
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Historique */}
            <button
              onClick={() => router.push('/dashboard/history')}
              className="bg-gradient-to-br from-slate-700/50 to-slate-800/50 hover:from-slate-700/70 hover:to-slate-800/70 border border-white/10 hover:border-blue-500/50 rounded-xl p-5 text-left transition group"
            >
              <History className="text-blue-400 mb-3" size={28} />
              <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-blue-400 transition">
                Historique
              </h3>
              <p className="text-gray-400 text-sm">Voir tous les votes passés</p>
            </button>

            {/* Statistiques */}
            <button
              onClick={() => router.push('/dashboard/stats')}
              className="bg-gradient-to-br from-purple-700/50 to-purple-800/50 hover:from-purple-700/70 hover:to-purple-800/70 border border-white/10 hover:border-purple-500/50 rounded-xl p-5 text-left transition group"
            >
              <BarChart3 className="text-purple-400 mb-3" size={28} />
              <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-purple-400 transition">
                Statistiques
              </h3>
              <p className="text-gray-400 text-sm">Master TOP, FLOP & Fantômes</p>
            </button>

            {/* Badges */}
            <button
              onClick={() => router.push('/dashboard/badges')}
              className="bg-gradient-to-br from-yellow-700/50 to-orange-700/50 hover:from-yellow-700/70 hover:to-orange-700/70 border border-white/10 hover:border-yellow-500/50 rounded-xl p-5 text-left transition group"
            >
              <Award className="text-yellow-400 mb-3" size={28} />
              <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-yellow-400 transition">
                Badges
              </h3>
              <p className="text-gray-400 text-sm">Réalisations & trophées</p>
            </button>

            {/* Citations */}
            <button
              onClick={() => router.push('/dashboard/quotes')}
              className="bg-gradient-to-br from-pink-700/50 to-rose-700/50 hover:from-pink-700/70 hover:to-rose-700/70 border border-white/10 hover:border-pink-500/50 rounded-xl p-5 text-left transition group"
            >
              <MessageSquareQuote className="text-pink-400 mb-3" size={28} />
              <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-pink-400 transition">
                Citations
              </h3>
              <p className="text-gray-400 text-sm">Hall of Fame des commentaires</p>
            </button>

            {/* Rivalités */}
            <button
              onClick={() => router.push('/dashboard/rivalries')}
              className="bg-gradient-to-br from-red-700/50 to-orange-700/50 hover:from-red-700/70 hover:to-orange-700/70 border border-white/10 hover:border-red-500/50 rounded-xl p-5 text-left transition group"
            >
              <Swords className="text-red-400 mb-3" size={28} />
              <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-red-400 transition">
                Rivalités
              </h3>
              <p className="text-gray-400 text-sm">Rivaux, supporters & duels</p>
            </button>

            {/* Prédictions */}
            <button
              onClick={() => router.push('/dashboard/predictions-leaderboard')}
              className="bg-gradient-to-br from-cyan-700/50 to-blue-700/50 hover:from-cyan-700/70 hover:to-blue-700/70 border border-white/10 hover:border-cyan-500/50 rounded-xl p-5 text-left transition group"
            >
              <Target className="text-cyan-400 mb-3" size={28} />
              <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-cyan-400 transition">
                Pronostiqueurs
              </h3>
              <p className="text-gray-400 text-sm">Classement des prédictions</p>
            </button>
          </div>
        </div>

        {/* Section 4: Membres de l'équipe */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-blue-400" />
              Membres de l&apos;équipe
            </h2>
            {isManager && selectedTeam.pendingRequests > 0 && (
              <button
                onClick={() => router.push('/dashboard/requests')}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                <UserPlus size={18} />
                {selectedTeam.pendingRequests} demande{selectedTeam.pendingRequests > 1 ? 's' : ''}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(member => {
              const displayName = member.nickname || 
                                (member.first_name && member.last_name 
                                  ? `${member.first_name} ${member.last_name}` 
                                  : member.email || 'Membre')
              
              return (
                <div key={member.id} className="bg-slate-700/30 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">
                          {displayName[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold">{displayName}</p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        member.role === 'creator' ? 'bg-yellow-500/20 text-yellow-300' :
                        member.role === 'manager' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {member.role === 'creator' ? 'Créateur' :
                         member.role === 'manager' ? 'Manager' : 'Membre'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 5: Actions équipes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/onboarding')}
            className="bg-slate-700/50 hover:bg-slate-700/70 border border-white/10 hover:border-green-500/50 text-white py-4 px-6 rounded-xl font-semibold transition flex items-center justify-center gap-3"
          >
            <UserPlus size={24} />
            Rejoindre une autre équipe
          </button>

          {teams.length > 1 && (
            <button
              onClick={() => setSelectedTeam(null)}
              className="bg-slate-700/50 hover:bg-slate-700/70 border border-white/10 hover:border-purple-500/50 text-white py-4 px-6 rounded-xl font-semibold transition flex items-center justify-center gap-3"
            >
              <RefreshCw size={24} />
              Switcher vers le dashboard d&apos;une autre équipe
            </button>
          )}
        </div>
      </div>
    </div>
  )
}