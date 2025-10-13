'use client'

import { useState, useEffect } from 'react'
import { Users, Calendar, Plus, LogOut, Loader, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
const [team, setTeam] = useState<{
  id: string
  name: string
  sport: string
  description?: string
  userRole: string
} | null>(null)
const [members, setMembers] = useState<Array<{
  id: string
  role: string
  joined_at: string
  user_id: string
}>>([])
const [user, setUser] = useState<{ id: string; email?: string } | null>(null)


  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const supabase = createClient()
      
      // Récupérer l'utilisateur connecté
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)

      // Récupérer la première équipe de l'utilisateur
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', currentUser.id)
        .limit(1)
        .single()

      if (!membership) {
        // Pas d'équipe, rediriger vers onboarding
        router.push('/onboarding')
        return
      }

      // Charger l'équipe
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('id', membership.team_id)
        .single()

      setTeam({ ...teamData, userRole: membership.role })

      // Charger les membres
      const { data: membersData } = await supabase
        .from('team_members')
        .select(`
          id,
          role,
          joined_at,
          user_id
        `)
        .eq('team_id', membership.team_id)

      setMembers(membersData || [])

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
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

  if (!team) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 max-w-md">
          <AlertCircle className="text-red-400 mb-4" size={32} />
          <h2 className="text-white text-xl font-bold mb-2">Aucune équipe trouvée</h2>
          <p className="text-gray-300 mb-4">Vous devez créer ou rejoindre une équipe.</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Aller à l&apos;onboarding
          </button>
        </div>
      </div>
    )
  }

  const isManager = team.userRole === 'creator' || team.userRole === 'manager'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-orange-500 rounded-lg flex items-center justify-center font-bold text-white">
                T3
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{team.name}</h1>
                <p className="text-xs text-gray-400">{team.sport}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <LogOut size={20} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cartes statistiques */}
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

        {/* Section membres */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Membres de l&apos;équipe</h2>
            {isManager && (
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition text-sm">
                Inviter
              </button>
            )}
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

        {/* Actions rapides */}
        {isManager && (
          <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Actions rapides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                <Plus size={20} />
                Créer une saison
              </button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                <Calendar size={20} />
                Créer un match
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}