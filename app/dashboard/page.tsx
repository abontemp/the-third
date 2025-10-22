'use client'
import { createClient } from '@/lib/supabase/client'
import { Users, Calendar, Plus, LogOut, Loader, CheckCircle, Vote, Trophy, Trash2, TrendingUp, Quote, Swords, Award, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type VotingSession = {
  id: string
  status: string
  flop_reader_id?: string
  top_reader_id?: string
  match: {
    opponent: string
    match_date: string
  }
  has_voted: boolean
  is_participant: boolean
}

type Team = {
  id: string
  name: string
  sport: string
  description?: string
  userRole: string
  memberCount: number
}

type Member = {
  id: string
  role: string
  joined_at: string
  user_id: string
  display_name: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [votingSessions, setVotingSessions] = useState<VotingSession[]>([])
  const [currentUserName, setCurrentUserName] = useState('')
  const [user, setUser] = useState<{ id: string } | null>(null)
  
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [hasVotes, setHasVotes] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showManagerModal, setShowManagerModal] = useState(false)

  const handleToggleManager = async (member: Member) => {
    if (!selectedTeam) return
    
    const newRole = member.role === 'manager' ? 'member' : 'manager'
    
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('user_id', member.user_id)
        .eq('id', member.id)
      
      if (error) throw error
      
      await loadTeamDetails(selectedTeam.id, selectedTeam)
      
      alert(`${member.display_name} est maintenant ${newRole === 'manager' ? 'manager' : 'membre'}`)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la modification du rôle')
    }
  }

  useEffect(() => {
    loadDashboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboard = async () => {
    try {
      setLoading(true)
      
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        console.error('Pas d\'utilisateur malgré le middleware')
        return
      }
      setUser(currentUser)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, nickname')
        .eq('id', currentUser.id)
        .single()

      if (profileData) {
        let displayName = 'Utilisateur'
        
        if (profileData.nickname?.trim()) {
          displayName = profileData.nickname.trim()
        } else if (profileData.first_name || profileData.last_name) {
          const firstName = profileData.first_name?.trim() || ''
          const lastName = profileData.last_name?.trim() || ''
          displayName = `${firstName} ${lastName}`.trim()
        } else if (profileData.email) {
          displayName = profileData.email
        }
        
        setCurrentUserName(displayName)
      } else {
        setCurrentUserName(currentUser.email || 'Utilisateur')
      }

      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', currentUser.id)

      if (!memberships || memberships.length === 0) {
        router.push('/onboarding')
        return
      }

      const teamsData = await Promise.all(
        memberships.map(async (membership) => {
          const { data: teamData } = await supabase
            .from('teams')
            .select('*')
            .eq('id', membership.team_id)
            .single()

          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', membership.team_id)

          return {
            ...teamData,
            userRole: membership.role,
            memberCount: count || 0
          }
        })
      )

      setTeams(teamsData)

      if (teamsData.length === 1) {
        await loadTeamDetails(teamsData[0].id, teamsData[0])
      } else {
        const savedTeamId = localStorage.getItem('selectedTeamId')
        
        if (savedTeamId) {
          const savedTeam = teamsData.find(t => t.id === savedTeamId)
          if (savedTeam) {
            await loadTeamDetails(savedTeam.id, savedTeam)
          }
        }
      }

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinVote = async (sessionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      const { error } = await supabase
        .from('session_participants')
        .insert([{
          session_id: sessionId,
          user_id: user.id,
          has_voted: false
        }])

      if (error) throw error

      if (selectedTeam) {
        await loadTeamDetails(selectedTeam.id, selectedTeam)
      }

      alert('Vous avez rejoint le vote !')
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la tentative de rejoindre le vote')
    }
  }

  const handleDeleteMemberClick = async (member: Member) => {
    if (!selectedTeam) return
    
    setMemberToDelete(member)
    
    const { data: seasons } = await supabase
      .from('seasons')
      .select('id')
      .eq('team_id', selectedTeam.id)
    
    if (seasons && seasons.length > 0) {
      const seasonIds = seasons.map(s => s.id)
      
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .in('season_id', seasonIds)
      
      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id)
        
        const { data: sessions } = await supabase
          .from('voting_sessions')
          .select('id')
          .in('match_id', matchIds)
        
        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id)
          
          const { count: votesCount } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .in('session_id', sessionIds)
            .or(`top_player_id.eq.${member.user_id},flop_player_id.eq.${member.user_id}`)
          
          setHasVotes((votesCount || 0) > 0)
        } else {
          setHasVotes(false)
        }
      } else {
        setHasVotes(false)
      }
    } else {
      setHasVotes(false)
    }
    
    setShowDeleteModal(true)
  }

  const confirmDeleteMember = async () => {
    if (!memberToDelete || !selectedTeam) return
    
    try {
      setDeleting(true)
      
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberToDelete.id)
      
      if (error) throw error
      
      await loadTeamDetails(selectedTeam.id, selectedTeam)
      
      setShowDeleteModal(false)
      setMemberToDelete(null)
      alert('Membre supprimé avec succès')
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la suppression du membre')
    } finally {
      setDeleting(false)
    }
  }

  const loadTeamDetails = async (teamId: string, team: Team) => {
    localStorage.setItem('selectedTeamId', teamId)
    setSelectedTeam(team)
    
    console.log('🔍 [DASHBOARD] Chargement des détails pour team:', teamId)
    
    const { data: membersData, error: membersError } = await supabase
      .from('team_members')
      .select('id, role, joined_at, user_id')
      .eq('team_id', teamId)

    if (membersError) {
      console.error('❌ [DASHBOARD] Erreur membres:', membersError)
      setMembers([])
    } else if (!membersData || membersData.length === 0) {
      console.log('⚠️ [DASHBOARD] Aucun membre trouvé')
      setMembers([])
    } else {
      const userIds = membersData.map(m => m.user_id)
      
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, nickname')
        .in('id', userIds)

      const profilesMap: Record<string, {
        first_name?: string
        last_name?: string
        email?: string
        nickname?: string
      }> = {}
      
      profilesData?.forEach(profile => {
        profilesMap[profile.id] = {
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          nickname: profile.nickname
        }
      })

      const formattedMembers = membersData.map(member => {
        const profile = profilesMap[member.user_id]
        let displayName = `Membre #${member.user_id.substring(0, 8)}`
        
        if (profile) {
          if (profile.nickname?.trim()) {
            displayName = profile.nickname.trim()
          } else if (profile.first_name || profile.last_name) {
            const firstName = profile.first_name?.trim() || ''
            const lastName = profile.last_name?.trim() || ''
            const fullName = `${firstName} ${lastName}`.trim()
            if (fullName) displayName = fullName
          } else if (profile.email) {
            displayName = profile.email
          }
        }
        
        return {
          id: member.id,
          role: member.role,
          joined_at: member.joined_at,
          user_id: member.user_id,
          display_name: displayName
        }
      })

      console.log('✅ [DASHBOARD] Membres formatés:', formattedMembers.length)
      setMembers(formattedMembers)
    }

    const { data: { user: currentUser } } = await supabase.auth.getUser()
    
    if (currentUser) {
      const { data: seasonsData } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', teamId)

      const seasonIds = seasonsData?.map(s => s.id) || []

      if (seasonIds.length > 0) {
        const { data: matchesData } = await supabase
          .from('matches')
          .select('id')
          .in('season_id', seasonIds)

        const matchIds = matchesData?.map(m => m.id) || []

        if (matchIds.length > 0) {
          console.log('🔍 [DASHBOARD] Chargement des sessions...')
          
          const { data: sessionsData } = await supabase
            .from('voting_sessions')
            .select(`
              id,
              status,
              flop_reader_id,
              top_reader_id,
              match_id,
              matches (
                opponent,
                match_date
              )
            `)
            .in('match_id', matchIds)
            .in('status', ['open', 'reading'])

          console.log('✅ [DASHBOARD] Sessions:', sessionsData?.length || 0)

          if (sessionsData && sessionsData.length > 0) {
            const sessionsWithStatus = await Promise.all(
              sessionsData.map(async (session) => {
                const { data: participantData } = await supabase
                  .from('session_participants')
                  .select('has_voted')
                  .eq('session_id', session.id)
                  .eq('user_id', currentUser.id)
                  .maybeSingle()

                const matchData = Array.isArray(session.matches) 
                  ? session.matches[0] 
                  : session.matches

                return {
                  id: session.id,
                  status: session.status,
                  flop_reader_id: session.flop_reader_id,
                  top_reader_id: session.top_reader_id,
                  match: {
                    opponent: matchData?.opponent || '',
                    match_date: matchData?.match_date || ''
                  },
                  has_voted: participantData?.has_voted || false,
                  is_participant: !!participantData
                }
              })
            )

            setVotingSessions(sessionsWithStatus)
          } else {
            setVotingSessions([])
          }
        }
      }
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('selectedTeamId')
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  if (!selectedTeam && teams.length > 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">Sélectionnez votre équipe</h1>
            <p className="text-gray-400 mb-8 text-center">Vous faites partie de {teams.length} équipes</p>

            <div className="space-y-3">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => loadTeamDetails(team.id, team)}
                  className="w-full bg-slate-700/30 hover:bg-slate-700/50 border border-white/10 hover:border-blue-500/50 rounded-xl p-6 text-left transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-xl font-bold text-white">{team.name}</h3>
                      <p className="text-blue-400 text-sm">{team.sport}</p>
                    </div>
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
                    <p className="text-gray-400 text-sm">{team.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-gray-500 text-sm">{team.memberCount} membres</p>
                    {localStorage.getItem('selectedTeamId') === team.id && (
                      <span className="text-green-400 text-xs font-semibold">✓ Par défaut</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => router.push('/onboarding')}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
            >
              Rejoindre une autre équipe
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isManager = selectedTeam && (selectedTeam.userRole === 'creator' || selectedTeam.userRole === 'manager')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
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
              <div className="hidden sm:flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-lg border border-white/10 cursor-pointer hover:border-blue-500/50 transition"
                   onClick={() => router.push('/dashboard/profile')}>
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {currentUserName ? currentUserName[0].toUpperCase() : 'U'}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{currentUserName}</p>
                  <p className="text-xs text-gray-400">Voir mon profil</p>
                </div>
              </div>

              {teams.length > 1 && (
                <button
                  onClick={() => setSelectedTeam(null)}
                  className="text-sm text-gray-400 hover:text-white transition"
                >
                  Changer d&apos;équipe
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline">Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="text-blue-400" size={24} />
              <span className="text-3xl font-bold text-white">{members.length}</span>
            </div>
            <p className="text-gray-400 text-sm">Membres</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="text-orange-400" size={24} />
              <span className="text-3xl font-bold text-white">0</span>
            </div>
            <p className="text-gray-400 text-sm">Matchs</p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Plus className="text-purple-400" size={24} />
              <span className="text-3xl font-bold text-white">0</span>
            </div>
            <p className="text-gray-400 text-sm">Saisons</p>
          </div>
        </div>

        {votingSessions.length > 0 && (
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Votes en cours</h2>
            <div className="space-y-3">
              {votingSessions.map((session) => (
                <div 
                  key={session.id}
                  className="bg-slate-800/50 border border-white/10 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">
                        {session.match.opponent}
                      </h3>
                      <p className="text-sm text-gray-400 mb-3">
                        {new Date(session.match.match_date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>

                      {session.status === 'reading' && (session.flop_reader_id === user?.id || session.top_reader_id === user?.id) ? (
                        <button
                          onClick={() => {
                            console.log('🔵 [DASHBOARD] Redirection lecture, session:', session.id)
                            router.push(`/vote/${session.id}/reading`)
                          }}
                          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                        >
                          <Vote size={18} />
                          Lire les votes
                        </button>
                      ) : session.status === 'reading' ? (
                        <div className="flex items-center gap-2 text-purple-400">
                          <Vote size={18} />
                          <span className="text-sm">Lecture en cours...</span>
                        </div>
                      ) : session.has_voted ? (
                        <div className="flex items-center gap-2 text-green-400">
                          <CheckCircle size={18} />
                          <span className="text-sm">Vous avez voté</span>
                        </div>
                      ) : session.is_participant ? (
                        <button
                          onClick={() => {
                            console.log('🔵 [DASHBOARD] Redirection vote, session:', session.id)
                            router.push(`/vote/${session.id}`)
                          }}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                        >
                          <Vote size={18} />
                          Voter maintenant
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinVote(session.id)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                        >
                          <Plus size={18} />
                          Rejoindre le vote
                        </button>
                      )}
                    </div>

                    {isManager && (
                      <button
                        onClick={() => router.push(`/vote/${session.id}/manage`)}
                        className="ml-4 text-blue-400 hover:text-blue-300 transition"
                      >
                        Gérer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isManager && members.length > 0 && (
          <div className="bg-gradient-to-br from-green-900/30 to-teal-900/30 border border-green-500/30 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">Gestion de l&apos;équipe</h2>
              <button
                onClick={() => setShowManagerModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition"
              >
                Gérer les managers
              </button>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-slate-800/30 to-slate-900/30 border border-white/10 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Membres de l&apos;équipe</h2>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-slate-700/30 border border-white/10 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {member.display_name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {member.display_name}
                    </p>
                    <p className="text-sm text-gray-400">
                      Rejoint le {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    member.role === 'creator' ? 'bg-yellow-500/20 text-yellow-300' :
                    member.role === 'manager' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {member.role === 'creator' ? 'Créateur' :
                     member.role === 'manager' ? 'Manager' : 'Membre'}
                  </span>
                  
                  {isManager && member.user_id !== user?.id && member.role !== 'creator' && (
                    <button
                      onClick={() => handleDeleteMemberClick(member)}
                      className="text-red-400 hover:text-red-300 transition p-2"
                      title="Supprimer ce membre"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isManager && (
          <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Actions rapides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={() => router.push('/dashboard/matches/create')}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                Créer un match
              </button>
              <button 
                onClick={() => router.push('/dashboard/history')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <Calendar size={20} />
                Historique
              </button>
              <button 
                onClick={() => router.push('/dashboard/stats')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <TrendingUp size={20} />
                Statistiques
              </button>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Équipes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => router.push('/onboarding')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Rejoindre une équipe
            </button>
            {teams.length > 1 && (
              <button 
                onClick={() => setSelectedTeam(null)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                <Users size={20} />
                Changer d&apos;équipe
              </button>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-pink-900/30 to-purple-900/30 border border-pink-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">🎮 Fonctionnalités Fun</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              onClick={() => router.push('/dashboard/badges')}
              className="bg-gradient-to-br from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Award size={20} />
              Mes Badges
            </button>
            <button 
              onClick={() => router.push('/dashboard/quotes')}
              className="bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Quote size={20} />
              Citations
            </button>
            <button 
              onClick={() => router.push('/dashboard/rivalries')}
              className="bg-gradient-to-br from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Swords size={20} />
              Rivalités
            </button>
            <button 
              onClick={() => router.push('/dashboard/predictions-leaderboard')}
              className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Sparkles size={20} />
              Pronostiqueurs
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">
              Confirmer la suppression
            </h3>
            <p className="text-gray-300 mb-6">
              {hasVotes ? (
                <>
                  <span className="text-orange-400 font-semibold">⚠️ Ce joueur a déjà reçu des votes.</span>
                  <br /><br />
                  Êtes-vous sûr de vouloir le supprimer ?
                </>
              ) : (
                <>Êtes-vous sûr de vouloir supprimer ce membre ?</>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setMemberToDelete(null)
                }}
                disabled={deleting}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteMember}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showManagerModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-4">
              Gestion des managers
            </h3>
            <p className="text-gray-400 mb-6 text-sm">
              Les managers peuvent créer des matchs, gérer les votes et voir les statistiques
            </p>

            <div className="space-y-3 mb-6">
              {members
                .filter(m => m.role !== 'creator')
                .map((member) => (
                  <div key={member.id} className="bg-slate-700/30 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        {member.display_name}
                      </p>
                      <p className="text-sm text-gray-400">
                        {member.role === 'manager' ? '✅ Manager' : 'Membre'}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleToggleManager(member)}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        member.role === 'manager'
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {member.role === 'manager' ? 'Retirer' : 'Nommer manager'}
                    </button>
                  </div>
                ))}
            </div>

            <button
              onClick={() => setShowManagerModal(false)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}