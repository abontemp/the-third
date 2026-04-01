'use client'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/client'
import { getDisplayName } from '@/lib/utils/displayName'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Users, CheckCircle, Clock, AlertCircle, Play, Loader, XCircle, Share2, Copy, Check } from 'lucide-react'

type Participant = {
  user_id: string
  has_voted: boolean
  display_name: string
}

type Session = {
  id: string
  status: string
  match: {
    opponent: string
    match_date: string
  }
}

export default function ManageVotePage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [isManager, setIsManager] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()

    // Écoute Realtime des changements sur session_participants
    const subscription = supabase
      .channel(`manage-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'session_participants',
        filter: `session_id=eq.${sessionId}`,
      }, () => { loadData() })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'voting_sessions',
        filter: `id=eq.${sessionId}`,
      }, () => { loadData() })
      .subscribe()

    return () => { supabase.removeChannel(subscription) }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer la session de vote
      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          matches!voting_sessions_match_id_fkey(
            opponent,
            match_date
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData || !sessionData.matches) {
        setError('Session introuvable')
        return
      }

      // Transformer les données pour correspondre au type Session
      const session: Session = {
        id: sessionData.id,
        status: sessionData.status,
        match: Array.isArray(sessionData.matches) ? sessionData.matches[0] : sessionData.matches
      }

      setSession(session)

      // Vérifier si l'utilisateur est manager
      const { data: matchData } = await supabase
        .from('voting_sessions')
        .select(`
          matches!voting_sessions_match_id_fkey(
            seasons!matches_season_id_fkey(team_id)
          )
        `)
        .eq('id', sessionId)
        .single()

      if (matchData && matchData.matches) {
        const match = Array.isArray(matchData.matches) ? matchData.matches[0] : matchData.matches
        const season = Array.isArray(match.seasons) ? match.seasons[0] : match.seasons
        const teamId = season?.team_id
        
        if (teamId) {
          const { data: membership } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', teamId)
            .eq('user_id', user.id)
            .single()

          const isUserManager = membership?.role === 'manager' || membership?.role === 'creator'
          setIsManager(isUserManager)

          if (!isUserManager) {
            router.push('/dashboard')
            return
          }
        } else {
          router.push('/dashboard')
          return
        }
      } else {
        router.push('/dashboard')
        return
      }

      // Récupérer les participants
      const { data: participantsData } = await supabase
        .from('session_participants')
        .select('user_id, has_voted')
        .eq('session_id', sessionId)

      if (participantsData && participantsData.length > 0) {
        // Batch : récupérer tous les profils en une seule requête
        const participantIds = participantsData.map(p => p.user_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, nickname')
          .in('id', participantIds)

        const profilesMap: Record<string, any> = {}
        profiles?.forEach(p => { profilesMap[p.id] = p })

        setParticipants(participantsData.map(p => ({
          user_id: p.user_id,
          has_voted: p.has_voted,
          display_name: getDisplayName(profilesMap[p.user_id])
        })))
      }

    } catch (err) {
      logger.error('Erreur chargement:', err)
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = () => {
    const voteUrl = `${window.location.origin}/vote/${sessionId}`
    navigator.clipboard.writeText(voteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShareWhatsApp = () => {
    const voteUrl = `${window.location.origin}/vote/${sessionId}`
    const message = `🗳️ Vote en cours pour le match contre ${session?.match.opponent}!\n\nVote ici : ${voteUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleShareEmail = () => {
    const voteUrl = `${window.location.origin}/vote/${sessionId}`
    const subject = `Vote : Match contre ${session?.match.opponent}`
    const body = `Bonjour,\n\nLe vote est ouvert pour le match contre ${session?.match.opponent}.\n\nVote ici : ${voteUrl}\n\nBonne chance !`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const handleCloseVote = async () => {
    const votedParticipants = participants.filter(p => p.has_voted)
    
    if (votedParticipants.length < 2) {
      alert('Il faut au moins 2 personnes ayant voté pour clôturer')
      return
    }

    if (!confirm('Êtes-vous sûr de vouloir clôturer ce vote ? Cette action est irréversible.')) {
      return
    }

    try {
      setClosing(true)

      // Sélectionner 2 lecteurs aléatoires
      const shuffled = [...votedParticipants].sort(() => Math.random() - 0.5)
      const topReaderId = shuffled[0].user_id
      const flopReaderId = shuffled[1].user_id

      // Mettre à jour la session
      const { error: updateError } = await supabase
        .from('voting_sessions')
        .update({
          status: 'reading',
          top_reader_id: topReaderId,
          flop_reader_id: flopReaderId
        })
        .eq('id', sessionId)

      if (updateError) throw updateError

      alert('Vote clôturé ! Les lecteurs ont été sélectionnés.')
      router.push(`/vote/${sessionId}/reading`)

    } catch (err) {
      logger.error('Erreur:', err)
      alert('Erreur lors de la clôture du vote')
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

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <XCircle className="text-red-400 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-gray-300 mb-6">{error}</p>
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-2xl p-6">
            <h1 className="text-3xl font-bold text-white mb-6">Gestion du vote</h1>

            {/* Section de partage */}
            {session?.status === 'open' && (
              <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-3 mb-4">
                  <Share2 className="text-green-400 flex-shrink-0 mt-1" size={24} />
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">Partager le vote</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Partagez le lien de vote avec les participants
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={handleCopyLink}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        {copied ? (
                          <>
                            <Check size={18} />
                            <span>Copié !</span>
                          </>
                        ) : (
                          <>
                            <Copy size={18} />
                            <span>Copier le lien</span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={handleShareWhatsApp}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Share2 size={18} />
                        <span>WhatsApp</span>
                      </button>
                      
                      <button
                        onClick={handleShareEmail}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Share2 size={18} />
                        <span>Email</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users size={20} />
                  Progression des votes
                </h3>
                <span className="text-white font-bold">{votedCount} / {totalCount} ({percentage}%)</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Liste des participants */}
            <div className="space-y-2 mb-6">
              {participants.map((participant) => (
                <div 
                  key={participant.user_id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    participant.has_voted 
                      ? 'bg-green-500/10 border border-green-500/30' 
                      : 'bg-slate-700/30 border border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      participant.has_voted 
                        ? 'bg-green-600' 
                        : 'bg-slate-600'
                    }`}>
                      {participant.has_voted ? (
                        <CheckCircle className="text-white" size={20} />
                      ) : (
                        <Clock className="text-gray-400" size={20} />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-medium">{participant.display_name}</p>
                      <p className={`text-sm ${
                        participant.has_voted ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {participant.has_voted ? 'A voté' : 'En attente'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bouton de clôture */}
            {session?.status === 'open' && (
              <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-xl p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="text-orange-400 flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">Clôturer le vote</h3>
                    <p className="text-gray-400 text-sm">
                      Une fois clôturé, les lecteurs seront sélectionnés aléatoirement parmi les votants.
                      Il faut au moins 2 personnes ayant voté.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCloseVote}
                  disabled={closing || votedCount < 2}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {closing ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      Clôture en cours...
                    </>
                  ) : (
                    <>
                      <Play size={20} />
                      Clôturer le vote
                    </>
                  )}
                </button>

                {votedCount < 2 && (
                  <p className="text-orange-400 text-sm mt-2 text-center">
                    Attendez qu&apos;au moins 2 personnes aient voté
                  </p>
                )}
              </div>
            )}

            {session?.status !== 'open' && (
              <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-6 text-center">
                <h3 className="text-2xl font-bold text-white mb-2">Vote clôturé</h3>
                <p className="text-gray-400 mb-4">Les résultats sont disponibles</p>
                <button
                  onClick={() => router.push(`/vote/${sessionId}/results`)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition"
                >
                  Voir les résultats
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}