'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Trophy, ThumbsDown, Eye, Calendar } from 'lucide-react'

type VotingSession = {
  id: string
  status: string
  created_at: string
  match: {
    opponent: string
    match_date: string
  }
  vote_count: number
}

export default function HistoryPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<VotingSession[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadHistory = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer les équipes de l'utilisateur
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)

      if (!memberships || memberships.length === 0) {
        return
      }

      // Vérifier si manager d'au moins une équipe
      const managerTeams = memberships.filter(m => 
        m.role === 'manager' || m.role === 'creator'
      )

      if (managerTeams.length === 0) {
        router.push('/dashboard')
        return
      }

      // Utiliser la première équipe pour l'instant
      const teamId = managerTeams[0].team_id
      setSelectedTeam(teamId)

      // Charger les saisons de l'équipe
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', teamId)

      const seasonIds = seasons?.map(s => s.id) || []

      if (seasonIds.length === 0) {
        setLoading(false)
        return
      }

      // Charger les matchs
      const { data: matches } = await supabase
        .from('matches')
        .select('id')
        .in('season_id', seasonIds)

      const matchIds = matches?.map(m => m.id) || []

      if (matchIds.length === 0) {
        setLoading(false)
        return
      }

      // Charger toutes les sessions de vote (fermées uniquement)
      const { data: sessionsData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          created_at,
          match_id,
          matches (
            opponent,
            match_date
          )
        `)
        .in('match_id', matchIds)
        .eq('status', 'closed')
        .order('created_at', { ascending: false })

      if (!sessionsData) {
        setLoading(false)
        return
      }

      // Compter les votes pour chaque session
      const sessionsWithCounts = await Promise.all(
        sessionsData.map(async (session) => {
          const { count } = await supabase
            .from('votes')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)

          const match = Array.isArray(session.matches)
            ? session.matches[0]
            : session.matches

          return {
            id: session.id,
            status: session.status,
            created_at: session.created_at,
            match: {
              opponent: match?.opponent || '',
              match_date: match?.match_date || ''
            },
            vote_count: count || 0
          }
        })
      )

      setSessions(sessionsWithCounts)

    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

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
              <h1 className="text-xl font-bold text-white">Historique des votes</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {sessions.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Calendar className="text-gray-400 mx-auto mb-4" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Aucun vote terminé</h2>
            <p className="text-gray-400">Les votes terminés apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-6">
              Votes terminés ({sessions.length})
            </h2>

            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {session.match.opponent}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={16} />
                        {new Date(session.match.match_date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                      <span>•</span>
                      <span>{session.vote_count} votes</span>
                      <span>•</span>
                      <span className="text-green-400">Terminé</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => router.push(`/vote/${session.id}/reading`)}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
                      title="Revoir la lecture des votes"
                    >
                      <Eye size={18} />
                      <span className="hidden sm:inline">Revoir les votes</span>
                    </button>

                    <button
                      onClick={() => router.push(`/vote/${session.id}/results`)}
                      className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-4 py-2 rounded-lg transition"
                      title="Voir le podium"
                    >
                      <Trophy size={18} />
                      <span className="hidden sm:inline">Podium</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}