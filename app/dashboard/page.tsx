'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { 
  Plus, Loader, Users, History, BarChart3, 
  ArrowRight, Trophy, MessageSquareQuote, Swords, Target,
  Award, Calendar, TrendingUp, UserPlus, RefreshCw, Trash2,
  CheckCircle, Play, AlertCircle, Clock, LogOut
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
  status: 'open' |'pending' | 'in_progress' | 'reading' | 'completed'
  flop_reader_id?: string
  top_reader_id?: string
  matches: {
    opponent: string
    match_date: string
    location: string | null
  }
  has_voted?: boolean
  is_participant?: boolean
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
  display_name: string
}

type Participant = {
  id: string
  user_id: string
  has_voted: boolean
  display_name: string
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string>('')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [activeSessions, setActiveSessions] = useState<VotingSession[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [pendingRequests, setPendingRequests] = useState<{
    id: string
    user_id: string
    display_name: string
    email: string
    created_at: string
  }[]>([])
  
  // Modals & actions
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showManagerModal, setShowManagerModal] = useState(false)
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [memberHasVotes, setMemberHasVotes] = useState(false)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)
  
  // Session management
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionParticipants, setSessionParticipants] = useState<Record<string, Participant[]>>({})
  const [closingSession, setClosingSession] = useState<string | null>(null)

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

      setCurrentUserId(user.id)

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
      
      // Récupérer l'équipe sélectionnée depuis le localStorage
      const savedTeamId = localStorage.getItem('selectedTeamId')
      
      if (savedTeamId) {
        // Vérifier que l'équipe sauvegardée existe toujours
        const savedTeam = teamsData.find(t => t.id === savedTeamId)
        if (savedTeam) {
          setSelectedTeam(savedTeam)
        } else {
          // Si l'équipe n'existe plus, sélectionner la première
          if (teamsData.length > 0) {
            setSelectedTeam(teamsData[0])
            localStorage.setItem('selectedTeamId', teamsData[0].id)
          }
        }
      } else {
        // Pas d'équipe sauvegardée, sélectionner la première
        if (teamsData.length > 0) {
          setSelectedTeam(teamsData[0])
          localStorage.setItem('selectedTeamId', teamsData[0].id)
        }
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
      console.log('🔍 Chargement des données pour l\'équipe:', selectedTeam.id)
      
      // D'abord, récupérer toutes les saisons de cette équipe
      const { data: seasons, error: seasonsError } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', selectedTeam.id)

      console.log('Saisons trouvées:', seasons)

      if (!seasons || seasons.length === 0) {
        setActiveSessions([])
      } else {
        const seasonIds = seasons.map(s => s.id)
        
        // Charger tous les matchs de ces saisons
        const { data: matches } = await supabase
          .from('matches')
          .select('id, opponent, match_date, location, season_id')
          .in('season_id', seasonIds)
          .order('match_date', { ascending: false })

        if (!matches || matches.length === 0) {
          setActiveSessions([])
        } else {
          // Récupérer toutes les sessions pour ces matchs
          const matchIds = matches.map(m => m.id)
          const { data: votingSessions } = await supabase
            .from('voting_sessions')
            .select('id, match_id, status, flop_reader_id, top_reader_id')
            .in('match_id', matchIds)
            .neq('status', 'completed')

          if (!votingSessions || votingSessions.length === 0) {
            setActiveSessions([])
          } else {
            // Créer une map des matchs
            const matchesMap: Record<string, any> = {}
            matches.forEach(m => {
              matchesMap[m.id] = m
            })

            // Vérifier pour chaque session si l'utilisateur a voté
            const sessionsWithVoteStatus = await Promise.all(
              votingSessions.map(async (session: any) => {
                const match = matchesMap[session.match_id]
                
                // Vérifier si l'utilisateur est participant
                const { data: participant } = await supabase
                  .from('session_participants')
                  .select('has_voted')
                  .eq('session_id', session.id)
                  .eq('user_id', currentUserId)
                  .single()

                return {
                  id: session.id,
                  match_id: session.match_id,
                  status: session.status,
                  flop_reader_id: session.flop_reader_id,
                  top_reader_id: session.top_reader_id,
                  matches: {
                    opponent: match?.opponent || 'Inconnu',
                    match_date: match?.match_date || new Date().toISOString(),
                    location: match?.location || null
                  },
                  has_voted: participant?.has_voted || false,
                  is_participant: !!participant
                }
              })
            )

            setActiveSessions(sessionsWithVoteStatus)
          }
        }
      }

      // Charger les membres
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id, user_id, role')
        .eq('team_id', selectedTeam.id)
        .order('role', { ascending: true })

      if (!teamMembers || teamMembers.length === 0) {
        setMembers([])
        return
      }

      // Récupérer les profils séparément
      const userIds = teamMembers.map((m: any) => m.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, email, avatar_url')
        .in('id', userIds)

      // Créer une map des profils
      const profilesMap: Record<string, any> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = p
      })

      // Combiner les données
      const membersData = teamMembers.map((m: any) => {
        const profile = profilesMap[m.user_id]
        const displayName = profile?.nickname || 
                          (profile?.first_name && profile?.last_name 
                            ? `${profile.first_name} ${profile.last_name}` 
                            : profile?.email || `Membre #${m.user_id.substring(0, 8)}`)
        
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          first_name: profile?.first_name || null,
          last_name: profile?.last_name || null,
          nickname: profile?.nickname || null,
          email: profile?.email || null,
          avatar_url: profile?.avatar_url || null,
          display_name: displayName
        }
      })

      setMembers(membersData)

      // Charger les demandes d'adhésion en attente (managers seulement)
      if (selectedTeam.userRole === 'creator' || selectedTeam.userRole === 'manager') {
        const { data: requestsData } = await supabase
          .from('join_requests')
          .select('id, user_id, created_at')
          .eq('team_id', selectedTeam.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: true })

        if (requestsData && requestsData.length > 0) {
          const requestUserIds = requestsData.map(r => r.user_id)
          const { data: requestProfiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, nickname, email')
            .in('id', requestUserIds)

          const requestsWithNames = requestsData.map(request => {
            const profile = requestProfiles?.find(p => p.id === request.user_id)
            const displayName = profile?.nickname || 
                              (profile?.first_name && profile?.last_name 
                                ? `${profile.first_name} ${profile.last_name}` 
                                : profile?.email || 'Utilisateur inconnu')
            
            return {
              id: request.id,
              user_id: request.user_id,
              display_name: displayName,
              email: profile?.email || '',
              created_at: request.created_at
            }
          })

          setPendingRequests(requestsWithNames)
        } else {
          setPendingRequests([])
        }
      }

    } catch (error) {
      console.error('❌ Erreur lors du chargement des données:', error)
    }
  }

  const loadSessionParticipants = async (sessionId: string) => {
    try {
      const { data: participants } = await supabase
        .from('session_participants')
        .select('id, user_id, has_voted')
        .eq('session_id', sessionId)

      if (!participants) return

      const userIds = participants.map(p => p.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, email')
        .in('id', userIds)

      const profilesMap: Record<string, any> = {}
      profiles?.forEach(p => {
        profilesMap[p.id] = p
      })

      const participantsData = participants.map(p => {
        const profile = profilesMap[p.user_id]
        return {
          id: p.id,
          user_id: p.user_id,
          has_voted: p.has_voted,
          display_name: profile?.nickname || 
                       (profile?.first_name && profile?.last_name 
                         ? `${profile.first_name} ${profile.last_name}` 
                         : profile?.email || 'Inconnu')
        }
      })

      setSessionParticipants(prev => ({
        ...prev,
        [sessionId]: participantsData
      }))
    } catch (error) {
      console.error('Erreur chargement participants:', error)
    }
  }

  const getReaderName = (userId: string | undefined): string => {
    if (!userId) return 'Non assigné'
    
    const member = members.find(m => m.user_id === userId)
    return member?.display_name || 'Inconnu'
  }

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null)
    } else {
      setExpandedSession(sessionId)
      if (!sessionParticipants[sessionId]) {
        await loadSessionParticipants(sessionId)
      }
    }
  }

  const handleCloseVoting = async (session: VotingSession) => {
    if (!window.confirm('Êtes-vous sûr de vouloir clôturer ce vote ?')) return

    setClosingSession(session.id)

    try {
      const participants = sessionParticipants[session.id]
      if (!participants) {
        await loadSessionParticipants(session.id)
        return
      }

      const voters = participants.filter(p => p.has_voted)
      
      if (voters.length < 2) {
        alert('Il faut au moins 2 personnes ayant voté pour clôturer')
        return
      }

      // Sélectionner aléatoirement 2 lecteurs
      const shuffled = [...voters].sort(() => Math.random() - 0.5)
      const topReader = shuffled[0]
      const flopReader = shuffled[1]

      const { error } = await supabase
        .from('voting_sessions')
        .update({
          status: 'reading',
          top_reader_id: topReader.user_id,
          flop_reader_id: flopReader.user_id
        })
        .eq('id', session.id)

      if (error) throw error

      alert(`Vote clôturé !\n\nLecteur TOP : ${topReader.display_name}\nLecteur FLOP : ${flopReader.display_name}`)
      
      loadTeamData()

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la clôture du vote')
    } finally {
      setClosingSession(null)
    }
  }

  const handleDeleteMemberClick = async (member: Member) => {
    setMemberToDelete(member)
    
    // Vérifier si le membre a des votes
    const { count } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .or(`voter_id.eq.${member.user_id},top_player_id.eq.${member.user_id},flop_player_id.eq.${member.user_id}`)
    
    setMemberHasVotes((count || 0) > 0)
    setShowDeleteModal(true)
  }

  const confirmDeleteMember = async () => {
    if (!memberToDelete || !selectedTeam) return

    setDeleting(true)
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberToDelete.id)

      if (error) throw error

      setShowDeleteModal(false)
      setMemberToDelete(null)
      loadTeamData()
    } catch (error) {
      console.error('Erreur lors de la suppression:', error)
      alert('Erreur lors de la suppression du membre')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleManager = async (member: Member) => {
    if (!selectedTeam) return

    const newRole = member.role === 'manager' ? 'member' : 'manager'
    
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole })
        .eq('id', member.id)

      if (error) throw error

      loadTeamData()
    } catch (error) {
      console.error('Erreur lors de la modification du rôle:', error)
      alert('Erreur lors de la modification du rôle')
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      alert('Erreur lors de la déconnexion')
    }
  }

  const handleAcceptRequest = async (requestId: string, userId: string) => {
    if (!selectedTeam) return
    
    setProcessingRequest(requestId)
    try {
      // Ajouter le membre à l'équipe
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: selectedTeam.id,
          user_id: userId,
          role: 'member'
        }])

      if (memberError) throw memberError

      // Mettre à jour le statut de la demande
      const { error: requestError } = await supabase
        .from('join_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)

      if (requestError) throw requestError

      // Recharger les données
      loadTeamData()
    } catch (error) {
      console.error('Erreur lors de l\'acceptation:', error)
      alert('Erreur lors de l\'acceptation de la demande')
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir rejeter cette demande ?')) return
    
    setProcessingRequest(requestId)
    try {
      const { error } = await supabase
        .from('join_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)

      if (error) throw error

      // Recharger les données
      loadTeamData()
    } catch (error) {
      console.error('Erreur lors du rejet:', error)
      alert('Erreur lors du rejet de la demande')
    } finally {
      setProcessingRequest(null)
    }
  }

  const getStatusInfo = (session: VotingSession) => {
    if (session.status === 'reading') {
      const isTopReader = session.top_reader_id === currentUserId
      const isFlopReader = session.flop_reader_id === currentUserId
      
      if (isTopReader || isFlopReader) {
        return {
          label: '🎤 Vous êtes lecteur !',
          color: 'bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse',
          canRead: true
        }
      }
      return {
        label: 'En lecture',
        color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        canRead: false
      }
    }
    
    if (session.status === 'in_progress' || session.status === 'open') {
      return {
        label: 'Vote en cours',
        color: 'bg-green-500/20 text-green-300 border-green-500/30',
        canRead: false
      }
    }
    
    return {
      label: 'En attente',
      color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      canRead: false
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
                  onClick={() => {
                    setSelectedTeam(team)
                    // Sauvegarder l'équipe sélectionnée dans localStorage
                    localStorage.setItem('selectedTeamId', team.id)
                  }}
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
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-lg border border-red-500/30 hover:border-red-500/50 transition"
                title="Se déconnecter"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline text-sm font-medium">Déconnexion</span>
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
                const statusInfo = getStatusInfo(session)
                const participants = sessionParticipants[session.id]
                const isExpanded = expandedSession === session.id
                
                return (
                  <div
                    key={session.id}
                    className="bg-slate-700/30 border border-white/10 rounded-xl overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-white font-semibold text-lg">
                            vs {session.matches.opponent}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {new Date(session.matches.match_date).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                          
                          {/* Affichage des lecteurs si status = reading */}
                          {session.status === 'reading' && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-purple-400">
                                🎤 Lecteur TOP : <span className="font-semibold">{getReaderName(session.top_reader_id)}</span>
                              </p>
                              <p className="text-xs text-purple-400">
                                🎤 Lecteur FLOP : <span className="font-semibold">{getReaderName(session.flop_reader_id)}</span>
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Bouton voter - NOUVEAU STYLE */}
                        {(session.status === 'open' || session.status === 'pending' || session.status === 'in_progress') && session.is_participant && (
                          session.has_voted ? (
                            <div className="flex items-center gap-2 text-green-400 font-semibold">
                              <CheckCircle size={20} />
                              <span>✅ Vous avez voté</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                console.log('🗳️ Redirection vers vote:', session.id)
                                router.push(`/vote/${session.id}`)
                              }}
                              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold transition flex items-center gap-2 shadow-lg animate-pulse"
                            >
                              <Play size={20} />
                              🗳️ Voter maintenant
                            </button>
                          )
                        )}

                        {/* Bouton lecture */}
                        {session.status === 'reading' && statusInfo.canRead && (
                          <button
                            onClick={() => router.push(`/vote/${session.id}/reading`)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 animate-pulse"
                          >
                            <Play size={16} />
                            Commencer la lecture
                          </button>
                        )}

                        {/* Bouton Gérer (Manager seulement) */}
                        {isManager && (
                          <button
                            onClick={() => handleExpandSession(session.id)}
                            className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
                          >
                            <Users size={16} />
                            {isExpanded ? 'Masquer' : 'Gérer'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Section étendue - Participants + Bouton Clôturer */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 bg-slate-800/30">
                        {participants ? (
                          <>
                            <h4 className="text-white font-semibold mb-3">
                              Participants ({participants.filter(p => p.has_voted).length}/{participants.length})
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                              {participants.map(p => (
                                <div 
                                  key={p.id}
                                  className="flex items-center justify-between bg-slate-700/30 rounded-lg p-2"
                                >
                                  <span className="text-white text-sm">{p.display_name}</span>
                                  {p.has_voted ? (
                                    <CheckCircle className="text-green-400" size={16} />
                                  ) : (
                                    <Clock className="text-gray-400" size={16} />
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Bouton Clôturer - DÉPLACÉ ICI */}
                            {(session.status === 'open' || session.status === 'in_progress') && (
                              <button
                                onClick={() => handleCloseVoting(session)}
                                disabled={closingSession === session.id}
                                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                              >
                                {closingSession === session.id ? (
                                  <>
                                    <Loader size={18} className="animate-spin" />
                                    <span>Clôture en cours...</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock size={18} />
                                    <span>Clôturer le vote</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-center py-4">
                            <Loader className="animate-spin text-blue-400" size={24} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
            {isManager && (
              <button
                onClick={() => setShowManagerModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
              >
                Gérer les managers
              </button>
            )}
          </div>

          {/* Demandes en attente (Managers seulement) */}
          {isManager && pendingRequests.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-orange-400 mb-3 flex items-center gap-2">
                <AlertCircle size={20} />
                Demandes en attente ({pendingRequests.length})
              </h3>
              <div className="space-y-3">
                {pendingRequests.map(request => (
                  <div
                    key={request.id}
                    className="bg-orange-500/10 border-2 border-orange-500/30 rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {request.display_name[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-semibold">{request.display_name}</p>
                        <p className="text-sm text-gray-400">{request.email}</p>
                        <p className="text-xs text-orange-400">
                          Demande envoyée le {new Date(request.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(request.id, request.user_id)}
                        disabled={processingRequest === request.id}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                      >
                        {processingRequest === request.id ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle size={16} />
                        )}
                        Accepter
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={processingRequest === request.id}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                      >
                        {processingRequest === request.id ? (
                          <Loader size={16} className="animate-spin" />
                        ) : (
                          <AlertCircle size={16} />
                        )}
                        Rejeter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liste des membres actuels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {members.map(member => (
              <div key={member.id} className="bg-slate-700/30 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-lg">
                        {member.display_name[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{member.display_name}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        member.role === 'creator' ? 'bg-yellow-500/20 text-yellow-300' :
                        member.role === 'manager' ? 'bg-purple-500/20 text-purple-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {member.role === 'creator' ? 'Créateur' :
                         member.role === 'manager' ? 'Manager' : 'Membre'}
                      </span>
                      
                      {isManager && member.user_id !== currentUserId && member.role !== 'creator' && (
                        <button
                          onClick={() => handleDeleteMemberClick(member)}
                          className="text-red-400 hover:text-red-300 transition p-1"
                          title="Supprimer ce membre"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
              onClick={() => {
                setSelectedTeam(null)
                // Effacer la sélection du localStorage pour forcer le choix
                localStorage.removeItem('selectedTeamId')
              }}
              className="bg-slate-700/50 hover:bg-slate-700/70 border border-white/10 hover:border-purple-500/50 text-white py-4 px-6 rounded-xl font-semibold transition flex items-center justify-center gap-3"
            >
              <RefreshCw size={24} />
              Switcher vers le dashboard d&apos;une autre équipe
            </button>
          )}
        </div>
      </div>

      {/* Modal de suppression */}
      {showDeleteModal && memberToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="text-red-400" size={24} />
              <h3 className="text-xl font-bold text-white">Confirmer la suppression</h3>
            </div>
            <p className="text-gray-300 mb-6">
              {memberHasVotes ? (
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

      {/* Modal de gestion des managers */}
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
                      <p className="font-semibold text-white">{member.display_name}</p>
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