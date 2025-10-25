'use client'
import { createClient } from '@/lib/supabase/client'
import { Users, Calendar, Plus, LogOut, Loader, CheckCircle, Vote, Trash2, TrendingUp, Quote, Swords, Award, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import NotificationBell from '@/components/NotificationBell'


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
          
          const { data: votes } = await supabase
            .from('votes')
            .select('id')
            .in('session_id', sessionIds)
            .or(`top_reader_id.eq.${member.user_id},flop_reader_id.eq.${member.user_id}`)
          
          setHasVotes(!!votes && votes.length > 0)
        }
      }
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
      
      alert('Membre supprimé avec succès')
      setShowDeleteModal(false)
      setMemberToDelete(null)
      
      await loadTeamDetails(selectedTeam.id, selectedTeam)
      
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la suppression du membre')
    } finally {
      setDeleting(false)
    }
  }

  const loadTeamDetails = async (teamId: string, teamData: Team) => {
    try {
      setSelectedTeam(teamData)
      localStorage.setItem('selectedTeamId', teamId)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: membersData } = await supabase
        .from('team_members')
        .select('id, role, joined_at, user_id')
        .eq('team_id', teamId)
        .order('joined_at', { ascending: true })

      if (!membersData) return

      const membersWithNames = await Promise.all(
        membersData.map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, nickname')
            .eq('id', member.user_id)
            .single()

          let displayName = 'Utilisateur'
          
          if (profile) {
            if (profile.nickname?.trim()) {
              displayName = profile.nickname.trim()
            } else if (profile.first_name || profile.last_name) {
              const firstName = profile.first_name?.trim() || ''
              const lastName = profile.last_name?.trim() || ''
              displayName = `${firstName} ${lastName}`.trim()
            } else if (profile.email) {
              displayName = profile.email
            }
          }

          return {
            ...member,
            display_name: displayName
          }
        })
      )

      setMembers(membersWithNames)

      const { data: currentSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_current', true)
        .single()

      if (!currentSeason) {
        console.log('❌ Aucune saison active trouvée pour cette équipe')
        console.log('Erreur:', seasonError)
        setVotingSessions([])
        return
      }
      
      console.log('✅ Saison active trouvée:', currentSeason.id)

      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, opponent, match_date')
        .eq('season_id', currentSeason.id)
        .order('match_date', { ascending: false })

      console.log('📅 Matchs trouvés:', matches?.length || 0)
      if (matchesError) console.log('Erreur matchs:', matchesError)

      if (!matches || matches.length === 0) {
        console.log('❌ Aucun match trouvé pour cette saison')
        setVotingSessions([])
        return
      }

      const sessionsData = await Promise.all(
        matches.map(async (match) => {
          const { data: session } = await supabase
            .from('voting_sessions')
            .select('id, status, flop_reader_id, top_reader_id')
            .eq('match_id', match.id)
            .single()

          if (!session) return null

          const { data: participation } = await supabase
            .from('session_participants')
            .select('has_voted')
            .eq('session_id', session.id)
            .eq('user_id', user.id)
            .single()

          return {
            id: session.id,
            status: session.status,
            flop_reader_id: session.flop_reader_id,
            top_reader_id: session.top_reader_id,
            match: {
              opponent: match.opponent,
              match_date: match.match_date
            },
            has_voted: participation?.has_voted || false,
            is_participant: !!participation
          }
        })
      )

      const validSessions = sessionsData.filter(s => s !== null) as VotingSession[]
      setVotingSessions(validSessions)

    } catch (err) {
      console.error('Erreur lors du chargement des détails:', err)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isCreator = selectedTeam?.userRole === 'creator'
  const isManager = selectedTeam?.userRole === 'manager' || isCreator

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  if (!selectedTeam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Mes Équipes</h1>
            <button
              onClick={handleLogout}
              className="text-white hover:text-red-400 transition flex items-center gap-2"
            >
              <LogOut size={20} />
              Déconnexion
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teams.map(team => (
              <div
                key={team.id}
                onClick={() => loadTeamDetails(team.id, team)}
                className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/30 rounded-xl p-6 cursor-pointer hover:border-purple-400/50 transition"
              >
                <h2 className="text-2xl font-bold text-white mb-2">{team.name}</h2>
                <p className="text-purple-300 mb-4">{team.sport}</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 flex items-center gap-2">
                    <Users size={18} />
                    {team.memberCount} membre{team.memberCount > 1 ? 's' : ''}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    team.userRole === 'creator' ? 'bg-yellow-500/20 text-yellow-300' :
                    team.userRole === 'manager' ? 'bg-purple-500/20 text-purple-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {team.userRole === 'creator' ? 'Créateur' :
                     team.userRole === 'manager' ? 'Manager' : 'Membre'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Vous souhaitez rejoindre une autre équipe ?</h2>
            <button 
              onClick={() => router.push('/dashboard/join-team')}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Plus size={20} />
              Demander à rejoindre une autre équipe
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            {teams.length > 1 && (
              <button
                onClick={() => setSelectedTeam(null)}
                className="text-purple-300 hover:text-purple-100 transition"
                title="Retour aux équipes"
              >
                <Users size={24} />
              </button>
            )}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white">{selectedTeam.name}</h1>
              <p className="text-purple-300">{selectedTeam.sport}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <button
              onClick={() => router.push('/dashboard/profile')}
              className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition border border-white/10"
              title="Voir mon profil"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {currentUserName[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-white hidden sm:inline">{currentUserName}</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-white hover:text-red-400 transition flex items-center gap-2"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Section des votes en cours et résultats */}
        {votingSessions.length === 0 ? (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-8 mb-6 text-center">
            <Calendar className="text-gray-400 mx-auto mb-4" size={48} />
            <h3 className="text-xl font-bold text-white mb-2">Aucun match pour le moment</h3>
            <p className="text-gray-400">
              {isManager 
                ? "Créez votre premier match pour commencer à voter !" 
                : "Les managers créeront bientôt le prochain match."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {votingSessions
              .filter(s => s.status === 'open')
              .map(session => (
              <div
                key={session.id}
                className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Vote className="text-green-400" size={24} />
                  <h3 className="text-xl font-bold text-white">Vote en cours</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Match contre <span className="font-bold text-white">{session.match.opponent}</span>
                  <br />
                  <span className="text-sm text-gray-400">
                    {new Date(session.match.match_date).toLocaleDateString()}
                  </span>
                </p>
                
                {session.is_participant ? (
                  session.has_voted ? (
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={20} />
                      <span className="font-semibold">Vous avez voté ✓</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => router.push(`/vote/${session.id}`)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                    >
                      Voter maintenant
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => handleJoinVote(session.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                  >
                    Rejoindre ce vote
                  </button>
                )}
                
                {isManager && (
                  <button
                    onClick={() => router.push(`/vote/${session.id}/manage`)}
                    className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  >
                    <Users size={20} />
                    Gérer le vote
                  </button>
                )}
              </div>
            ))}

          {votingSessions
            .filter(s => s.status === 'closed')
            .map(session => (
              <div
                key={session.id}
                className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="text-purple-400" size={24} />
                  <h3 className="text-xl font-bold text-white">Résultats disponibles</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Match contre <span className="font-bold text-white">{session.match.opponent}</span>
                  <br />
                  <span className="text-sm text-gray-400">
                    {new Date(session.match.match_date).toLocaleDateString()}
                  </span>
                </p>
                <button
                  onClick={() => router.push(`/vote/${session.id}/results`)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  Voir les résultats
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Membres de l&apos;équipe</h2>
            {isCreator && (
              <button
                onClick={() => setShowManagerModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition text-sm"
              >
                Gérer les managers
              </button>
            )}
          </div>
          <div className="space-y-3">
            {members.map(member => (
              <div
                key={member.id}
                className="bg-slate-700/30 border border-white/10 rounded-lg p-4 flex items-center justify-between hover:bg-slate-700/50 transition"
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

        {/* SECTION VOTES */}
        {votingSessions.length > 0 && (
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-xl p-6 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Vote className="text-purple-400" size={24} />
              Sessions de vote
            </h2>
            
            <div className="space-y-4">
              {votingSessions.map((session) => (
                <div 
                  key={session.id}
                  className="bg-slate-800/50 border border-white/10 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        {session.match.opponent}
                        {session.status === 'reading' && 
                         (session.flop_reader_id === user?.id || session.top_reader_id === user?.id) && (
                          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 text-xs font-semibold rounded-full animate-pulse">
                            🎤 Vous êtes lecteur !
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar size={16} />
                        {new Date(session.match.match_date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {session.status === 'open' && session.is_participant && (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          session.has_voted 
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                            : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        }`}>
                          {session.has_voted ? '✓ Voté' : '⏳ En attente'}
                        </span>
                      )}
                      
                      {session.status === 'reading' && (
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-semibold border border-blue-500/30">
                          📖 Lecture en cours
                        </span>
                      )}
                      
                      {session.status === 'completed' && (
                        <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold border border-green-500/30">
                          ✅ Terminé
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {/* Vote ouvert */}
                    {session.status === 'open' && session.is_participant && !session.has_voted && (
                      <button
                        onClick={() => router.push(`/vote/${session.id}`)}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                      >
                        <Vote size={18} />
                        Voter maintenant
                      </button>
                    )}

                    {/* Lecture en cours - bouton pour le lecteur */}
                    {session.status === 'reading' && 
                     (session.flop_reader_id === user?.id || session.top_reader_id === user?.id) && (
                      <button
                        onClick={() => router.push(`/vote/${session.id}/reading`)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 animate-pulse"
                      >
                        <Vote size={18} />
                        🎤 Commencer la lecture
                      </button>
                    )}

                    {/* Vote terminé - voir résultats */}
                    {session.status === 'completed' && (
                      <button
                        onClick={() => router.push(`/vote/${session.id}/results`)}
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                      >
                        <Award size={18} />
                        Voir les résultats
                      </button>
                    )}

                    {/* Bouton de gestion pour les managers */}
                    {isManager && session.status === 'open' && (
                      <button
                        onClick={() => router.push(`/vote/${session.id}/manage`)}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
                      >
                        <Users size={18} />
                        Gérer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        {/* NOUVELLE SECTION : Gestion d'équipe - visible pour tous */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Gestion d&apos;équipe</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => router.push('/dashboard/join-team')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
            >
              <Plus size={20} />
              Demander à rejoindre une autre équipe
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