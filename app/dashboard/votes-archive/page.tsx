'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader, Calendar, Trophy, Eye, Archive } from 'lucide-react'

type VotingSession = {
  id: string
  status: string
  created_at: string
  vote_count: number
  match: {
    opponent: string
    match_date: string
    location?: string
  }
}

export default function VotesArchivesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [archivedSessions, setArchivedSessions] = useState<VotingSession[]>([])

  useEffect(() => {
    loadArchivedSessions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadArchivedSessions = async () => {
    try {
      console.log('🔍 Chargement des sessions archivées...')
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer l'équipe
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        console.log('❌ Pas d\'équipe')
        setLoading(false)
        return
      }

      console.log('✅ Équipe:', membership.team_id)

      // Récupérer les sessions terminées
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          created_at,
          matches (
            opponent,
            match_date,
            location,
            season_id,
            seasons (
              team_id
            )
          )
        `)
        .eq('status', 'completed')
        .eq('matches.seasons.team_id', membership.team_id)
        .order('created_at', { ascending: false })

      if (sessionsError) {
        console.error('❌ Erreur sessions:', sessionsError)
        setLoading(false)
        return
      }

      console.log('✅ Sessions récupérées:', sessionsData?.length || 0)

      if (!sessionsData || sessionsData.length === 0) {
        setArchivedSessions([])
        setLoading(false)
        return
      }

      // Compter les votes par session
      const sessionIds = sessionsData.map(s => s.id)
      const { data: votesCount } = await supabase
        .from('votes')
        .select('session_id')
        .in('session_id', sessionIds)

      const votesMap: Record<string, number> = {}
      votesCount?.forEach(v => {
        votesMap[v.session_id] = (votesMap[v.session_id] || 0) + 1
      })

      // Formater les sessions
      const formatted = sessionsData.map(s => {
        const matchData = Array.isArray(s.matches) ? s.matches[0] : s.matches
        return {
          id: s.id,
          status: s.status,
          created_at: s.created_at,
          vote_count: votesMap[s.id] || 0,
          match: {
            opponent: matchData?.opponent || 'Match inconnu',
            match_date: matchData?.match_date || '',
            location: matchData?.location
          }
        }
      })

      setArchivedSessions(formatted)

    } catch (err) {
      console.error('❌ Erreur générale:', err)
    } finally {
      setLoading(false)
      console.log('✅ Chargement terminé')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="text-white animate-spin mx-auto mb-4" size={48} />
          <p className="text-gray-400">Chargement des archives...</p>
        </div>
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
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Archive size={24} />
              Votes précédents
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* En-tête */}
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-2xl p-8 mb-8 text-center">
          <Archive className="mx-auto mb-4 text-blue-400" size={64} />
          <h2 className="text-3xl font-bold text-white mb-2">Archives des votes</h2>
          <p className="text-gray-400">Tous les votes terminés de votre équipe</p>
          <div className="mt-4">
            <span className="text-4xl font-bold text-blue-400">{archivedSessions.length}</span>
            <span className="text-gray-400 ml-2">session{archivedSessions.length > 1 ? 's' : ''} archivée{archivedSessions.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Liste des sessions archivées */}
        {archivedSessions.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Archive className="mx-auto mb-4 text-gray-600" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Aucune session archivée</h2>
            <p className="text-gray-400">
              Les votes terminés apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {archivedSessions.map((session) => (
              <div 
                key={session.id}
                className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">
                      vs {session.match.opponent}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={16} />
                        {new Date(session.match.match_date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                      {session.match.location && (
                        <>
                          <span>•</span>
                          <span>{session.match.location}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{session.vote_count} vote{session.vote_count > 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span className="text-green-400">✓ Terminé</span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Archivé le {new Date(session.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => router.push(`/vote/${session.id}/reading`)}
                      className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition"
                      title="Revoir la lecture des votes"
                    >
                      <Eye size={18} />
                      <span className="hidden sm:inline">Revoir</span>
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