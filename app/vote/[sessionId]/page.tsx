'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, Trophy, ThumbsDown, Send, 
  AlertCircle, CheckCircle, Loader, Bold, 
  Italic, List
} from 'lucide-react'

type TeamMember = {
  id: string
  user_id: string
  first_name?: string
  last_name?: string
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

export default function VotePage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [session, setSession] = useState<VotingSession | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [hasVoted, setHasVoted] = useState(false)

  const [topPlayerId, setTopPlayerId] = useState('')
  const [topJustification, setTopJustification] = useState('')
  const [flopPlayerId, setFlopPlayerId] = useState('')
  const [flopJustification, setFlopJustification] = useState('')

  const [topEditorFocus, setTopEditorFocus] = useState(false)
  const [flopEditorFocus, setFlopEditorFocus] = useState(false)

  useEffect(() => {
    loadVotingData()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadVotingData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

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

      setSession({
        id: sessionData.id,
        status: sessionData.status,
        match: sessionData.matches as {
          opponent: string
          match_date: string
          location?: string
        }
      })

      if (sessionData.status === 'closed') {
        setError('Cette session de vote est fermée')
        return
      }

      const { data: participantData } = await supabase
        .from('session_participants')
        .select('has_voted')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (!participantData) {
        setError("Vous n'êtes pas autorisé à voter pour cette session")
        return
      }

      setHasVoted(participantData.has_voted)

      if (participantData.has_voted) {
        setSuccess('Vous avez déjà voté pour ce match !')
        return
      }

      const { data: participantsData } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)

      const userIds = participantsData?.map(p => p.user_id) || []

      const { data: teamMembersData } = await supabase
        .from('team_members')
        .select('id, user_id')
        .in('user_id', userIds)

      setMembers(teamMembersData || [])

    } catch (err) {
      console.error('Erreur:', err)
      setError('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const applyFormatting = (field: 'top' | 'flop', format: string) => {
    const textarea = document.getElementById(`${field}-editor`) as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = field === 'top' 
      ? topJustification.substring(start, end)
      : flopJustification.substring(start, end)

    let formattedText = selectedText

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`
        break
      case 'italic':
        formattedText = `*${selectedText}*`
        break
      case 'list':
        formattedText = `\n• ${selectedText}`
        break
    }

    const newText = field === 'top'
      ? topJustification.substring(0, start) + formattedText + topJustification.substring(end)
      : flopJustification.substring(0, start) + formattedText + flopJustification.substring(end)

    if (field === 'top') {
      setTopJustification(newText)
    } else {
      setFlopJustification(newText)
    }

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + formattedText.length, start + formattedText.length)
    }, 0)
  }

  const handleSubmit = async () => {
    if (!topPlayerId || !flopPlayerId) {
      setError('Veuillez sélectionner un Top et un Flop')
      return
    }

    if (topPlayerId === flopPlayerId) {
      setError('Le Top et le Flop doivent être différents')
      return
    }

    if (!topJustification.trim() || !flopJustification.trim()) {
      setError('Les justifications sont obligatoires')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) throw new Error('Non connecté')

      const { error: voteError } = await supabase
        .from('votes')
        .insert([{
          session_id: sessionId,
          voter_id: user.id,
          top_player_id: topPlayerId,
          top_justification: topJustification,
          flop_player_id: flopPlayerId,
          flop_justification: flopJustification
        }])

      if (voteError) throw voteError

      const { error: participantError } = await supabase
        .from('session_participants')
        .update({ has_voted: true })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)

      if (participantError) throw participantError

      setSuccess('Vote enregistré avec succès ! 🎉')
      setHasVoted(true)

      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)

    } catch (err: unknown) {
      console.error('Erreur:', err)
      setError(err instanceof Error ? err.message : 'Erreur lors du vote')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  if (hasVoted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 max-w-md text-center">
          <CheckCircle className="text-green-400 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-white mb-2">Vote enregistré !</h2>
          <p className="text-gray-300 mb-6">Merci d&apos;avoir participé au vote.</p>
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
          <h1 className="text-4xl font-bold text-white mb-2">Votez pour votre Top & Flop</h1>
          <p className="text-gray-400">Sélectionnez les joueurs et justifiez votre choix</p>
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

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-900/50 to-slate-800/50 border border-blue-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="text-blue-400" size={32} />
              <h2 className="text-2xl font-bold text-white">Votre TOP</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sélectionnez le meilleur joueur *
                </label>
                <select
                  value={topPlayerId}
                  onChange={(e) => setTopPlayerId(e.target.value)}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                >
                  <option value="">Choisir un joueur...</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.user_id}>
                      Joueur #{member.user_id.substring(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Justification *
                </label>
                <div className={`border rounded-lg ${topEditorFocus ? 'border-blue-500' : 'border-white/10'}`}>
                  <div className="flex gap-2 p-2 border-b border-white/10 bg-slate-700/30">
                    <button
                      type="button"
                      onClick={() => applyFormatting('top', 'bold')}
                      className="p-2 hover:bg-slate-600/50 rounded transition"
                      title="Gras"
                    >
                      <Bold className="text-gray-400" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('top', 'italic')}
                      className="p-2 hover:bg-slate-600/50 rounded transition"
                      title="Italique"
                    >
                      <Italic className="text-gray-400" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('top', 'list')}
                      className="p-2 hover:bg-slate-600/50 rounded transition"
                      title="Liste"
                    >
                      <List className="text-gray-400" size={18} />
                    </button>
                  </div>
                  <textarea
                    id="top-editor"
                    value={topJustification}
                    onChange={(e) => setTopJustification(e.target.value)}
                    onFocus={() => setTopEditorFocus(true)}
                    onBlur={() => setTopEditorFocus(false)}
                    rows={6}
                    className="w-full bg-slate-700/50 px-4 py-3 text-white resize-none focus:outline-none rounded-b-lg"
                    placeholder="Expliquez pourquoi ce joueur mérite le TOP..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-900/50 to-slate-800/50 border border-orange-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <ThumbsDown className="text-orange-400" size={32} />
              <h2 className="text-2xl font-bold text-white">Votre FLOP</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sélectionnez le joueur à améliorer *
                </label>
                <select
                  value={flopPlayerId}
                  onChange={(e) => setFlopPlayerId(e.target.value)}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                >
                  <option value="">Choisir un joueur...</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.user_id}>
                      Joueur #{member.user_id.substring(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Justification *
                </label>
                <div className={`border rounded-lg ${flopEditorFocus ? 'border-orange-500' : 'border-white/10'}`}>
                  <div className="flex gap-2 p-2 border-b border-white/10 bg-slate-700/30">
                    <button
                      type="button"
                      onClick={() => applyFormatting('flop', 'bold')}
                      className="p-2 hover:bg-slate-600/50 rounded transition"
                      title="Gras"
                    >
                      <Bold className="text-gray-400" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('flop', 'italic')}
                      className="p-2 hover:bg-slate-600/50 rounded transition"
                      title="Italique"
                    >
                      <Italic className="text-gray-400" size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => applyFormatting('flop', 'list')}
                      className="p-2 hover:bg-slate-600/50 rounded transition"
                      title="Liste"
                    >
                      <List className="text-gray-400" size={18} />
                    </button>
                  </div>
                  <textarea
                    id="flop-editor"
                    value={flopJustification}
                    onChange={(e) => setFlopJustification(e.target.value)}
                    onFocus={() => setFlopEditorFocus(true)}
                    onBlur={() => setFlopEditorFocus(false)}
                    rows={6}
                    className="w-full bg-slate-700/50 px-4 py-3 text-white resize-none focus:outline-none rounded-b-lg"
                    placeholder="Expliquez de manière constructive..."
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !topPlayerId || !flopPlayerId}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader className="animate-spin" size={20} />
                <span>Envoi en cours...</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>Soumettre mon vote</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}