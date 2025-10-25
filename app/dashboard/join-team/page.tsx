'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Search, Users, Calendar, Trophy, Loader, ArrowLeft, Send } from 'lucide-react'

type Team = {
  id: string
  name: string
  sport: string
  created_at: string
  creator_name: string
  creator_id: string
  member_count: number
  user_status?: 'member' | 'pending' | null
  user_role?: string
}

export default function JoinTeamPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  useEffect(() => {
    loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    filterTeams()
  }, [searchQuery, teams]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTeams = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer toutes les équipes
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, sport, created_at')
        .order('created_at', { ascending: false })

      if (teamsError) {
        console.error('Erreur lors du chargement des équipes:', teamsError)
        alert('Erreur lors du chargement des équipes')
        return
      }

      if (!teamsData) {
        setTeams([])
        return
      }

      // Récupérer toutes les adhésions de l'utilisateur en une seule requête
      const { data: userMemberships } = await supabase
        .from('team_members')
        .select('team_id, role, status')
        .eq('user_id', user.id)

      const membershipMap: Record<string, { role: string; status: string }> = {}
      userMemberships?.forEach(m => {
        membershipMap[m.team_id] = { role: m.role, status: m.status }
      })

      // Pour chaque équipe, récupérer le créateur et le nombre de membres
      const teamsWithDetails = await Promise.all(
        teamsData.map(async (team) => {
          // Trouver le créateur (membre avec role 'creator')
          const { data: creator } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', team.id)
            .eq('role', 'creator')
            .single()

          let creatorName = 'Inconnu'
          let creatorId = ''

          if (creator) {
            creatorId = creator.user_id
            
            // Récupérer le profil du créateur
            const { data: creatorProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name, nickname, email')
              .eq('id', creator.user_id)
              .single()

            if (creatorProfile) {
              if (creatorProfile.nickname?.trim()) {
                creatorName = creatorProfile.nickname.trim()
              } else if (creatorProfile.first_name || creatorProfile.last_name) {
                const firstName = creatorProfile.first_name?.trim() || ''
                const lastName = creatorProfile.last_name?.trim() || ''
                creatorName = `${firstName} ${lastName}`.trim()
              } else if (creatorProfile.email) {
                creatorName = creatorProfile.email
              }
            }
          }

          // Compter les membres acceptés
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)

          // Vérifier le statut de l'utilisateur pour cette équipe
          const membership = membershipMap[team.id]
          const userStatus = membership ? 
            (membership.status === 'accepted' ? 'member' as const : 'pending' as const) : 
            null

          return {
            id: team.id,
            name: team.name,
            sport: team.sport,
            created_at: team.created_at,
            creator_name: creatorName,
            creator_id: creatorId,
            member_count: count || 0,
            user_status: userStatus,
            user_role: membership?.role
          }
        })
      )

      console.log('Équipes chargées:', teamsWithDetails)
      setTeams(teamsWithDetails)
      setFilteredTeams(teamsWithDetails)

    } catch (err) {
      console.error('Erreur chargement équipes:', err)
      alert('Erreur lors du chargement des équipes')
    } finally {
      setLoading(false)
    }
  }

  const filterTeams = () => {
    if (!searchQuery.trim()) {
      setFilteredTeams(teams)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = teams.filter(team => 
      team.name.toLowerCase().includes(query) ||
      team.sport.toLowerCase().includes(query) ||
      team.creator_name.toLowerCase().includes(query)
    )
    setFilteredTeams(filtered)
  }

  const handleJoinRequest = async (teamId: string) => {
    try {
      setSubmitting(true)
      setSelectedTeam(teamId)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Vérifier le statut dans les données locales
      const team = teams.find(t => t.id === teamId)
      if (team?.user_status === 'member') {
        alert('Vous êtes déjà membre de cette équipe !')
        return
      }
      if (team?.user_status === 'pending') {
        alert('Vous avez déjà une demande en attente pour cette équipe')
        return
      }

      // Créer une demande d'adhésion avec status 'pending'
      const { error: joinError } = await supabase
        .from('team_members')
        .insert([{
          team_id: teamId,
          user_id: user.id,
          role: 'member',
          status: 'pending'
        }])

      if (joinError) throw joinError

      // Créer des notifications pour tous les managers de l'équipe
      const { data: managers } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .in('role', ['creator', 'manager'])
        .eq('status', 'accepted')

      if (managers && managers.length > 0) {
        const notifications = managers.map(manager => ({
          user_id: manager.user_id,
          type: 'join_request',
          title: 'Nouvelle demande d\'adhésion',
          message: `Un utilisateur souhaite rejoindre votre équipe`,
          link: `/dashboard/requests`,
          is_read: false
        }))

        await supabase
          .from('notifications')
          .insert(notifications)
      }

      alert('Demande envoyée ! Les managers de l\'équipe vont examiner votre demande.')
      
      // Recharger les équipes pour mettre à jour le statut
      await loadTeams()

    } catch (err) {
      console.error('Erreur demande adhésion:', err)
      alert('Erreur lors de l\'envoi de la demande')
    } finally {
      setSubmitting(false)
      setSelectedTeam(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-purple-300 hover:text-purple-100 mb-6 flex items-center gap-2 transition"
        >
          <ArrowLeft size={20} />
          Retour au dashboard
        </button>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Demander à rejoindre une équipe</h1>

          {/* Résumé des adhésions */}
          {(teams.filter(t => t.user_status === 'member').length > 0 || 
            teams.filter(t => t.user_status === 'pending').length > 0) && (
            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teams.filter(t => t.user_status === 'member').length > 0 && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <h3 className="text-green-300 font-semibold">Vos équipes</h3>
                  </div>
                  <p className="text-white text-2xl font-bold">
                    {teams.filter(t => t.user_status === 'member').length}
                  </p>
                  <p className="text-green-400 text-sm">
                    équipe{teams.filter(t => t.user_status === 'member').length > 1 ? 's' : ''}
                  </p>
                </div>
              )}
              
              {teams.filter(t => t.user_status === 'pending').length > 0 && (
                <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                    <h3 className="text-orange-300 font-semibold">Demandes en attente</h3>
                  </div>
                  <p className="text-white text-2xl font-bold">
                    {teams.filter(t => t.user_status === 'pending').length}
                  </p>
                  <p className="text-orange-400 text-sm">
                    demande{teams.filter(t => t.user_status === 'pending').length > 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Barre de recherche */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom d'équipe, sport ou créateur..."
                className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Table des équipes */}
          {filteredTeams.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery ? 'Aucune équipe trouvée' : 'Aucune équipe disponible'}
              </h3>
              <p className="text-gray-400">
                {searchQuery ? 'Essayez avec d\'autres termes de recherche' : 'Soyez le premier à créer une équipe !'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 px-4 text-gray-300 font-semibold">Équipe</th>
                    <th className="text-left py-4 px-4 text-gray-300 font-semibold">Sport</th>
                    <th className="text-left py-4 px-4 text-gray-300 font-semibold">Créateur</th>
                    <th className="text-left py-4 px-4 text-gray-300 font-semibold">Membres</th>
                    <th className="text-left py-4 px-4 text-gray-300 font-semibold">Créée le</th>
                    <th className="text-right py-4 px-4 text-gray-300 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((team) => (
                    <tr 
                      key={team.id}
                      className="border-b border-white/5 hover:bg-slate-700/30 transition"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <Trophy className="text-white" size={20} />
                          </div>
                          <span className="text-white font-semibold">{team.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm">
                          {team.sport}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-gray-300">{team.creator_name}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Users size={16} />
                          <span>{team.member_count}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Calendar size={16} />
                          <span>{new Date(team.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {team.user_status === 'member' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="px-4 py-2 bg-green-500/20 text-green-300 rounded-lg font-semibold border border-green-500/30">
                              ✓ Membre
                            </span>
                          </div>
                        ) : team.user_status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="px-4 py-2 bg-orange-500/20 text-orange-300 rounded-lg font-semibold border border-orange-500/30">
                              ⏳ En attente
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleJoinRequest(team.id)}
                            disabled={submitting && selectedTeam === team.id}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto"
                          >
                            {submitting && selectedTeam === team.id ? (
                              <>
                                <Loader className="animate-spin" size={16} />
                                <span>Envoi...</span>
                              </>
                            ) : (
                              <>
                                <Send size={16} />
                                <span>Demander</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Info sur le processus */}
          <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Send size={18} />
              Comment ça marche ?
            </h3>
            <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside mb-3">
              <li>Recherchez l&apos;équipe de votre choix dans la liste</li>
              <li>Cliquez sur "Demander" pour envoyer votre demande</li>
              <li>Les managers recevront une notification</li>
              <li>Vous recevrez une notification lors de leur décision</li>
            </ol>
            
            <div className="border-t border-blue-500/30 pt-3 mt-3">
              <p className="text-gray-400 text-sm font-semibold mb-2">Légende des statuts :</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded text-xs border border-green-500/30">
                  ✓ Membre
                </span>
                <span className="text-gray-400 text-xs self-center">
                  Vous faites partie de cette équipe
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded text-xs border border-orange-500/30">
                  ⏳ En attente
                </span>
                <span className="text-gray-400 text-xs self-center">
                  Votre demande est en cours d&apos;examen
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}