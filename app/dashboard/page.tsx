'use client'

import { useState, useEffect } from 'react'
import { Users, Calendar, Plus, LogOut, Loader, CheckCircle, Vote } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Users, Calendar, Plus, LogOut, Loader, CheckCircle, Vote, Trophy } from 'lucide-react'

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

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
 const [members, setMembers] = useState<Array<{
  id: string
  role: string
  joined_at: string
  user_id: string
  first_name?: string
  last_name?: string
  email?: string
}>>([])
  const [votingSessions, setVotingSessions] = useState<VotingSession[]>([])
  const [currentUserName, setCurrentUserName] = useState('')



  useEffect(() => {
    loadDashboard()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDashboard = async () => {
    try {
      const supabase = createClient()
      
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }

      const { data: profileData } = await supabase
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', currentUser.id)
      .single()

    if (profileData) {
      const displayName = profileData.first_name && profileData.last_name
        ? `${profileData.first_name} ${profileData.last_name}`
        : profileData.email || currentUser.email
      setCurrentUserName(displayName)
    } else {
      setCurrentUserName(currentUser.email || 'Utilisateur')
    }

      // Récupérer toutes les équipes de l'utilisateur
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', currentUser.id)

      if (!memberships || memberships.length === 0) {
        router.push('/onboarding')
        return
      }

      // Charger les détails de toutes les équipes
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

      // Si une seule équipe, la sélectionner automatiquement
      if (teamsData.length === 1) {
        await loadTeamDetails(teamsData[0].id, teamsData[0])
      }

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

const handleJoinVote = async (sessionId: string) => {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Ajouter l'utilisateur aux participants
    const { error } = await supabase
      .from('session_participants')
      .insert([{
        session_id: sessionId,
        user_id: user.id,
        has_voted: false
      }])

    if (error) throw error

    // Recharger les données
    if (selectedTeam) {
      await loadTeamDetails(selectedTeam.id, selectedTeam)
    }

    alert('Vous avez rejoint le vote !')
  } catch (err) {
    console.error('Erreur:', err)
    alert('Erreur lors de la tentative de rejoindre le vote')
  }
}

const loadTeamDetails = async (teamId: string, team: Team) => {
  setSelectedTeam(team)
  
  const supabase = createClient()
  const { data: membersData } = await supabase
    .from('team_members')
    .select(`
      id, 
      role, 
      joined_at, 
      user_id,
      profiles (
        first_name,
        last_name,
        email
      )
    `)
    .eq('team_id', teamId)

  // Transformer les données pour avoir un format plat
  const formattedMembers = membersData?.map(member => ({
    id: member.id,
    role: member.role,
    joined_at: member.joined_at,
    user_id: member.user_id,
first_name: (member.profiles as { first_name?: string })?.first_name,
last_name: (member.profiles as { last_name?: string })?.last_name,
email: (member.profiles as { email?: string })?.email
  })) || []

  setMembers(formattedMembers)
    // Charger les votes en cours pour cette équipe
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
  .in('status', ['open', 'reading']) // Inclure les sessions en lecture

        if (sessionsData && sessionsData.length > 0) {
          const sessionsWithStatus = await Promise.all(
            sessionsData.map(async (session) => {
              const { data: participantData } = await supabase
                .from('session_participants')
                .select('has_voted')
                .eq('session_id', session.id)
                .eq('user_id', currentUser.id)
                .single()

              const matchData = Array.isArray(session.matches) 
                ? session.matches[0] 
                : session.matches

              return {
                id: session.id,
                status: session.status,
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
        }
      }
    }
  }
}

const handleLogout = async () => {
  const supabase = createClient()
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

  // Sélection d'équipe si plusieurs
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
                  <p className="text-gray-500 text-sm mt-2">{team.memberCount} membres</p>
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
    {/* ✅ NOUVEAU : Affichage du nom de l'utilisateur */}
    <div className="hidden sm:flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-lg border border-white/10">
      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
        {currentUserName ? currentUserName[0].toUpperCase() : 'U'}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-white">{currentUserName}</p>
        <p className="text-xs text-gray-400">Connecté</p>
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

      {/* Votes en cours */}
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

{/* Vérifier si l'utilisateur est lecteur désigné */}
{session.status === 'reading' && (session.flop_reader_id === currentUser.id || session.top_reader_id === currentUser.id) ? (
  <button
    onClick={() => router.push(`/vote/${session.id}/reading`)}
    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 animate-pulse"
  >
    <Trophy size={18} />
    🎤 Commencer la lecture des votes
  </button>
) : session.is_participant ? (
  session.has_voted ? (
    <div className="flex items-center gap-2 text-green-400">
      <CheckCircle size={18} />
      <span className="text-sm font-medium">Vous avez voté</span>
    </div>
  ) : (
    <button
      onClick={() => router.push(`/vote/${session.id}`)}
      className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
    >
      <Vote size={18} />
      Voter maintenant
    </button>
  )
) : (
  <button
    onClick={() => handleJoinVote(session.id)}
    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
  >
    <Plus size={18} />
    Rejoindre ce vote
  </button>
)}
                  </div>

                  {isManager && (
                    <button
                      onClick={() => router.push(`/vote/${session.id}/manage`)}
                      className="ml-4 text-gray-400 hover:text-white transition text-sm"
                    >
                      Gérer →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Membres de l&apos;équipe</h2>
        </div>

        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="bg-slate-700/30 border border-white/10 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  {member.first_name 
                    ? member.first_name[0].toUpperCase() 
                    : member.user_id.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {member.first_name && member.last_name 
                      ? `${member.first_name} ${member.last_name}`
                      : member.email || `Membre #${member.user_id.substring(0, 8)}`}
                  </p>
                  <p className="text-sm text-gray-400">
                    Rejoint le {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                member.role === 'creator' ? 'bg-yellow-500/20 text-yellow-300' :
                member.role === 'manager' ? 'bg-purple-500/20 text-purple-300' :
                'bg-blue-500/20 text-blue-300'
              }`}>
                {member.role === 'creator' ? 'Créateur' :
                 member.role === 'manager' ? 'Manager' : 'Membre'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isManager && (
        <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Actions rapides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => router.push('/dashboard/matches/create')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Créer un match
            </button>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2">
              <Calendar size={20} />
              Historique
            </button>
          </div>
        </div>
      )}
    </div>
  </div>
)
}