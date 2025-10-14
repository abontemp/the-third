'use client'

import { useState, useEffect } from 'react'
import { Users, Calendar, Plus, LogOut, Loader } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  }>>([])

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

  const loadTeamDetails = async (teamId: string, team: Team) => {
    setSelectedTeam(team)
    
    const supabase = createClient()
    const { data: membersData } = await supabase
      .from('team_members')
      .select('id, role, joined_at, user_id')
      .eq('team_id', teamId)

    setMembers(membersData || [])
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

        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Membres de l&apos;équipe</h2>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="bg-slate-700/30 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {member.user_id.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-white">Membre #{member.user_id.substring(0, 8)}</p>
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