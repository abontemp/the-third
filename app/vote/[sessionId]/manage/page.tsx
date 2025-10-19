'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, CheckCircle, Clock, Share2, Copy, MessageCircle, Mail, Users, Trophy, ThumbsDown, Play, XCircle, AlertCircle } from 'lucide-react'

type Participant = {
  user_id: string
  display_name: string
  has_voted: boolean
}

type VotingSession = {
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
  const sessionId = params.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [copySuccess, setCopySuccess] = useState(false)
  const [closing, setClosing] = useState(false)

  // Construire l'URL complète du vote
  const voteUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/vote/${sessionId}/predict`
    : ''

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true)

      // Charger la session
      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          matches (
            opponent,
            match_date
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        alert('Session introuvable')
        router.push('/dashboard')
        return
      }

      const matchData = Array.isArray(sessionData.matches) 
        ? sessionData.matches[0] 
        : sessionData.matches

      setSession({
        id: sessionData.id,
        status: sessionData.status,
        match: {
          opponent: matchData?.opponent || '',
          match_date: matchData?.match_date || ''
        }
      })

      // Charger les participants
      const { data: participantsData } = await supabase
        .from('session_participants')
        .select('user_id, has_voted')
        .eq('session_id', sessionId)

      if (participantsData) {
        const userIds = participantsData.map(p => p.user_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, nickname')
          .in('id', userIds)

        const profilesMap: Record<string, string> = {}
        profiles?.forEach(p => {
          profilesMap[p.id] = p.nickname || 
                             (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8))
        })

        setParticipants(participantsData.map(p => ({
          user_id: p.user_id,
          display_name: profilesMap[p.user_id] || 'Inconnu',
          has_voted: p.has_voted
        })))
      }

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(voteUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 3000)
    } catch (err) {
      console.error('Erreur copie:', err)
      alert('Impossible de copier le lien')
    }
  }

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`🏑 Nouveau vote disponible !\n\nVotez pour le TOP et FLOP du match contre ${session?.match.opponent} :\n${voteUrl}`)
    window.open(`https://wa.me/?text=${message}`, '_blank')
  }

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Vote pour le match contre ${session?.match.opponent}`)
    const body = encodeURIComponent(`Bonjour,\n\nUn nouveau vote est disponible pour le match contre ${session?.match.opponent}.\n\nVotez ici : ${voteUrl}\n\nMerci !`)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  const handleCloseVote = async () => {
    if (!confirm('Êtes-vous sûr de vouloir clôturer le vote ?')) return

    try {
      setClosing(true)

      // Sélectionner aléatoirement 2 lecteurs parmi ceux qui ont voté
      const voters = participants.filter(p => p.has_voted)
      
      if (voters.length < 2) {
        alert('Il faut au moins 2 personnes ayant voté pour clôturer')
        setClosing(false)
        return
      }

      const shuffled = [...voters].sort(() => Math.random() - 0.5)
      const topReader = shuffled[0]
      const flopReader = shuffled[1]

      // Mettre à jour la session
      const { error } = await supabase
        .from('voting_sessions')
        .update({
          status: 'reading',
          top_reader_id: topReader.user_id,
          flop_reader_id: flopReader.user_id
        })
        .eq('id', sessionId)

      if (error) throw error

      alert(`Vote clôturé !\n\nLecteur TOP : ${topReader.display_name}\nLecteur FLOP : ${flopReader.display_name}`)
      
      loadData()

    } catch (err) {
      console.error('Erreur:', err)
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

  const votedCount = participants.filter(p => p.has_voted).length
  const totalCount = participants.length
  const allVoted = votedCount === totalCount && totalCount > 0

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
            <h1 className="text-xl font-bold text-white">Gestion du vote</h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Info du match */}
        {session && (
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-blue-400 text-lg">
              Match contre <span className="font-bold text-white">{session.match.opponent}</span>
            </p>
            <p className="text-gray-400 text-sm">
              {new Date(session.match.match_date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>
        )}

        {/* Section de partage */}
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Share2 className="text-green-400" size={32} />
            <div>
              <h2 className="text-2xl font-bold text-white">Partager le vote</h2>
              <p className="text-gray-400 text-sm">Envoyez le lien aux participants</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={copyToClipboard}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              {copySuccess ? (
                <>
                  <CheckCircle size={20} />
                  Copié !
                </>
              ) : (
                <>
                  <Copy size={20} />
                  Copier le lien
                </>
              )}
            </button>

            <button
              onClick={shareViaWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <MessageCircle size={20} />
              WhatsApp
            </button>

            <button
              onClick={shareViaEmail}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2"
            >
              <Mail size={20} />
              Email
            </button>
          </div>

          <div className="mt-4 bg-slate-800/50 rounded-lg p-3 flex items-center gap-2">
            <input
              type="text"
              value={voteUrl}
              readOnly
              className="flex-1 bg-transparent text-gray-300 text-sm outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={copyToClipboard}
              className="text-blue-400 hover:text-blue-300 transition"
            >
              <Copy size={18} />
            </button>
          </div>
        </div>

        {/* État du vote */}
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={24} />
              Participants ({votedCount}/{totalCount})
            </h3>
            
            {allVoted && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg px-4 py-2">
                <p className="text-green-300 text-sm font-semibold">✅ Tout le monde a voté</p>
              </div>
            )}
          </div>

          {/* Barre de progression */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Progression</span>
              <span>{totalCount > 0 ? Math.round((votedCount / totalCount) * 100) : 0}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (votedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Liste des participants */}
          <div className="space-y-2">
            {participants.map((participant) => (
              <div 
                key={participant.user_id}
                className={`flex items-center justify-between p-3 rounded-lg ${
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
        </div>

        {/* Bouton de clôture */}
        {session?.status === 'open' && (
          <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-2xl p-6">
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
          </div>
        )}

        {session?.status === 'reading' && (
          <div className="bg-purple-900/30 border border-purple-500/30 rounded-xl p-6 text-center">
            <Trophy className="mx-auto mb-3 text-purple-400" size={48} />
            <h3 className="text-2xl font-bold text-white mb-2">Vote clôturé</h3>
            <p className="text-gray-400">Les lecteurs peuvent maintenant lire les votes</p>
          </div>
        )}
      </div>
    </div>
  )
}