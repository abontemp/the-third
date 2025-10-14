'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, Users, CheckCircle, Clock, 
  Loader, AlertCircle, Play, XCircle
} from 'lucide-react'

type Participant = {
  id: string
  user_id: string
  has_voted: boolean
}

type VotingSession = {
  id: string
  status: string
  match: {
    opponent: string
    match_date: string
    location?: string
  }
}

export default function ManageVotePage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [session, setSession] = useState<VotingSession | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isManager, setIsManager] = useState(false)

  useEffect(() => {
    loadSessionData()
    
    // Rafraîchir toutes les 5 secondes pour voir les votes en temps réel
    const interval = setInterval(() => {
      loadSessionData()
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessionData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Charger la session
      const { data: sessionData, error: sessionError } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          matches (
            opponent,
            match_date,
            location
          )
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError) throw sessionError

      const matchData = Array.isArray(sessionData.matches) 
        ? sessionData.matches[0] 
        : sessionData.matches

      setSession({
        id: sessionData.id,
        status: sessionData.status,
        match: {
          opponent: matchData?.opponent || '',
          match_date: matchData?.match_date || '',
          location: matchData?.location
        }
      })

      // Vérifier si l'utilisateur est manager
      const { data: matchData2 } = await supabase
        .from('matches')
        .select('season_id')
        .eq('id', sessionData.match_id)
        .single()

      if (matchData2) {
        const { data: seasonData } = await supabase
          .from('seasons')
          .select('team_id')
          .eq('id', matchData2.season_id)
          .single()

        if (seasonData) {
          const { data: memberData } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', seasonData.team_id)
            .eq('user_id', user.id)
            .single()

          setIsManager(memberData?.role === 'creator' || memberData?.role === 'manager')
        }
      }

      // Charger les participants
      const { data: participantsData } = await supabase
        .from('session_participants')
        .select('id, user_id, has_voted')
        .eq('session_id', sessionId)

      setParticipants(participantsData || [])

    } catch (err) {
      console.error('Erreur:', err)
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleCloseSession = async () => {
    if (!confirm('Êtes-vous sûr de vouloir clôturer cette session de vote ? Cette action est irréversible.')) {
      return
    }

    setClosing(true)
    setError('')

    try {
      const supabase = createClient()

      // Récupérer tous les votes
      const { data: votes } = await supabase
        .from('votes')
        .select('voter_id')
        .eq('session_id', sessionId)

      if (!votes || votes.length < 2) {
        setError('Il faut au moins 2 votes pour clôturer la session')
        setClosing(false)
        return
      }

      // Sélectionner aléatoirement 2 lecteurs parmi ceux qui ont voté
      const shuffled = [...votes].sort(() => 0.5 - Math.random())
      const flopReaderId = shuffled[0].voter_id
      const topReaderId = shuffled[1].voter_id

      // Mettre à jour la session
      const { error: updateError } = await supabase
        .from('voting_sessions')
        .update({ 
          status: 'reading',
          flop_reader_id: flopReaderId,
          top_reader_id: topReaderId
        })
        .eq('id', sessionId)

      if (updateError) throw updateError

      setSuccess('Session clôturée ! Lancement de la lecture...')
      
      setTimeout(() => {
        router.push(`/vote/${sessionId}/reading`)
      }, 1500)

    } catch (err: unknown) {
      console.error('Erreur:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors de la clôture')
    } finally {
      setClosing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <XCircle className="text-red-400 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-white mb-2">Accès refusé</h2>
          <p className="text-gray-300 mb-6">Seuls les managers peuvent gérer les votes.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  const votedCount = participants.filter(p => p.has_voted).length
  const totalCount = participants.length
  const percentage = totalCount > 0 ? Math.round((votedCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Retour</span>
            </button>

            <div className="text-right">
              <h2 className="text-white font-semibold">{session?.match.opponent}</h2>
              <p className="text-gray-400 text-sm">
                {session?.match.match_date && new Date(session.match.match_date).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Gestion du vote</h1>
          <p className="text-gray-400">Suivez l&apos;avancement et clôturez quand vous êtes prêt</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-400" size={20} />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle className="text-green-400" size={20} />
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        )}

        {/* Progression */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Progression des votes</h2>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">{votedCount}/{totalCount}</p>
              <p className="text-sm text-gray-400">{percentage}% complété</p>
            </div>
          </div>

          <div className="w-full bg-slate-700/50 rounded-full h-4 mb-6 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <div className="space-y-3">
            {participants.map((participant, index) => (
              <div 
                key={participant.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  participant.has_voted 
                    ? 'bg-green-500/10 border-green-500/30' 
                    : 'bg-slate-700/30 border-white/10'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {participant.user_id.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">Participant #{index + 1}</p>
                    <p className="text-sm text-gray-400">
                      {participant.user_id.substring(0, 12)}...
                    </p>
                  </div>
                </div>

                {participant.has_voted ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle size={20} />
                    <span className="text-sm font-medium">A voté</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-orange-400">
                    <Clock size={20} />
                    <span className="text-sm font-medium">En attente</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Actions</h2>
          
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-white/10">
              <p className="text-gray-300 text-sm mb-2">
                ℹ️ Lorsque vous clôturez le vote, le système sélectionnera automatiquement 2 lecteurs parmi ceux qui ont voté :
              </p>
              <ul className="text-gray-400 text-sm list-disc list-inside space-y-1">
                <li>1 lecteur pour les votes FLOP</li>
                <li>1 lecteur pour les votes TOP</li>
              </ul>
            </div>

            <button
              onClick={handleCloseSession}
              disabled={closing || votedCount < 2}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {closing ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>Clôture en cours...</span>
                </>
              ) : (
                <>
                  <Play size={20} />
                  <span>Clôturer et lancer la lecture</span>
                </>
              )}
            </button>

            {votedCount < 2 && (
              <p className="text-center text-sm text-orange-400">
                Attendez au moins 2 votes pour clôturer la session
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}