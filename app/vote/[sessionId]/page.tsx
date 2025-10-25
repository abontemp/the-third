'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Send, Loader, TrendingUp, TrendingDown, Trophy, Sparkles, Flame, AlertCircle } from 'lucide-react'

type Member = {
  user_id: string
  display_name: string
}

type VotingSession = {
  id: string
  status: string
  include_predictions: boolean
  include_best_action: boolean
  include_worst_action: boolean
  match: {
    opponent: string
    match_date: string
  }
}

export default function VotePage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [currentStep, setCurrentStep] = useState(1)

  // Prédictions
  const [predictedTopId, setPredictedTopId] = useState('')
  const [predictedFlopId, setPredictedFlopId] = useState('')

  // Votes obligatoires
  const [topPlayerId, setTopPlayerId] = useState('')
  const [topComment, setTopComment] = useState('')
  const [flopPlayerId, setFlopPlayerId] = useState('')
  const [flopComment, setFlopComment] = useState('')

  // Votes optionnels
  const [bestActionPlayerId, setBestActionPlayerId] = useState('')
  const [bestActionComment, setBestActionComment] = useState('')
  const [worstActionPlayerId, setWorstActionPlayerId] = useState('')
  const [worstActionComment, setWorstActionComment] = useState('')

  useEffect(() => {
    loadVoteData()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadVoteData = async () => {
    try {
      setLoading(true)

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
          include_predictions,
          include_best_action,
          include_worst_action,
          match:match_id(opponent, match_date)
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        alert('Session de vote introuvable')
        router.push('/dashboard')
        return
      }

      const sessionFormatted: VotingSession = {
        id: sessionData.id,
        status: sessionData.status,
        include_predictions: sessionData.include_predictions,
        include_best_action: sessionData.include_best_action,
        include_worst_action: sessionData.include_worst_action,
        match: Array.isArray(sessionData.match) ? sessionData.match[0] : sessionData.match
      }

      setSession(sessionFormatted)

      // Vérifier si l'utilisateur est participant
      const { data: participant } = await supabase
        .from('session_participants')
        .select('has_voted')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (!participant) {
        alert('Vous n\'êtes pas participant à ce vote')
        router.push('/dashboard')
        return
      }

      if (participant.has_voted) {
        alert('Vous avez déjà voté !')
        router.push('/dashboard')
        return
      }

      // Récupérer les participants
      const { data: participantsData } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)

      if (participantsData) {
        const userIds = participantsData.map(p => p.user_id)
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, nickname, email')
          .in('id', userIds)

        const formattedMembers = participantsData.map(p => {
          const profile = profilesData?.find(prof => prof.id === p.user_id)
          
          let displayName = 'Utilisateur'
          if (profile) {
            if (profile.nickname?.trim()) {
              displayName = profile.nickname.trim()
            } else if (profile.first_name || profile.last_name) {
              const firstName = profile.first_name?.trim() || ''
              const lastName = profile.last_name?.trim() || ''
              displayName = `${firstName} ${lastName}`.trim()
            } else if (profile.email) {
              displayName = profile.email
            }
          }

          return {
            user_id: p.user_id,
            display_name: displayName
          }
        })

        setMembers(formattedMembers)
      }

    } catch (err) {
      console.error('Erreur chargement:', err)
      alert('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleNextStep = () => {
    // Validation des prédictions si nécessaire
    if (currentStep === 1 && session?.include_predictions) {
      if (!predictedTopId || !predictedFlopId) {
        alert('Veuillez faire vos prédictions TOP et FLOP')
        return
      }
      if (predictedTopId === predictedFlopId) {
        alert('Les prédictions TOP et FLOP doivent être différentes')
        return
      }
    }

    setCurrentStep(currentStep + 1)
  }

  const handlePreviousStep = () => {
    setCurrentStep(currentStep - 1)
  }

  const handleSubmitVote = async () => {
    // Validations
    if (!topPlayerId || !flopPlayerId) {
      alert('Veuillez sélectionner un TOP et un FLOP')
      return
    }

    if (topPlayerId === flopPlayerId) {
      alert('Le TOP et le FLOP doivent être différents')
      return
    }

    if (!topComment.trim() || !flopComment.trim()) {
      alert('Veuillez ajouter des commentaires pour le TOP et le FLOP')
      return
    }

    if (session?.include_best_action && bestActionPlayerId && !bestActionComment.trim()) {
      alert('Veuillez ajouter un commentaire pour le plus beau geste')
      return
    }

    if (session?.include_worst_action && worstActionPlayerId && !worstActionComment.trim()) {
      alert('Veuillez ajouter un commentaire pour le plus beau fail')
      return
    }

    try {
      setSubmitting(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Créer le vote
      const voteData: any = {
        session_id: sessionId,
        user_id: user.id,
        top_player_id: topPlayerId,
        top_comment: topComment.trim(),
        flop_player_id: flopPlayerId,
        flop_comment: flopComment.trim()
      }

      // Ajouter les prédictions si activées
      if (session?.include_predictions) {
        voteData.predicted_top_id = predictedTopId
        voteData.predicted_flop_id = predictedFlopId
      }

      // Ajouter le plus beau geste si activé et renseigné
      if (session?.include_best_action && bestActionPlayerId) {
        voteData.best_action_player_id = bestActionPlayerId
        voteData.best_action_comment = bestActionComment.trim()
      }

      // Ajouter le plus beau fail si activé et renseigné
      if (session?.include_worst_action && worstActionPlayerId) {
        voteData.worst_action_player_id = worstActionPlayerId
        voteData.worst_action_comment = worstActionComment.trim()
      }

      const { error: voteError } = await supabase
        .from('votes')
        .insert([voteData])

      if (voteError) throw voteError

      // Marquer comme ayant voté
      const { error: updateError } = await supabase
        .from('session_participants')
        .update({ has_voted: true })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)

      if (updateError) throw updateError

      alert('Vote enregistré avec succès ! ✅')
      router.push('/dashboard')

    } catch (err) {
      console.error('Erreur soumission vote:', err)
      alert('Erreur lors de l\'enregistrement du vote')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="text-red-400 mx-auto mb-4" size={64} />
          <h2 className="text-2xl font-bold text-white mb-2">Session introuvable</h2>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  const totalSteps = 1 + 
    (session.include_predictions ? 1 : 0) + 
    (session.include_best_action ? 1 : 0) + 
    (session.include_worst_action ? 1 : 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-purple-300 hover:text-purple-100 mb-6 flex items-center gap-2 transition"
        >
          <ArrowLeft size={20} />
          Retour au dashboard
        </button>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Vote du match</h1>
            <p className="text-gray-300">
              Match contre <span className="font-semibold text-purple-300">{session.match.opponent}</span>
            </p>
            <p className="text-gray-400 text-sm">
              {new Date(session.match.match_date).toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Étape {currentStep} sur {totalSteps}</span>
              <span className="text-sm text-purple-400 font-semibold">
                {Math.round((currentStep / totalSteps) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Étape 1 : Prédictions (si activé) */}
          {currentStep === 1 && session.include_predictions && (
            <div className="space-y-6">
              <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Trophy className="text-purple-400 flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">🔮 Prédictions</h2>
                    <p className="text-gray-300 text-sm">
                      Avant de voir les votes, qui pensez-vous sera le TOP et le FLOP ?
                    </p>
                  </div>
                </div>
              </div>

              {/* Prédiction TOP */}
              <div>
                <label className="block text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp className="text-green-400" size={20} />
                  Qui sera le TOP selon vous ?
                </label>
                <select
                  value={predictedTopId}
                  onChange={(e) => setPredictedTopId(e.target.value)}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Sélectionnez un joueur</option>
                  {members.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prédiction FLOP */}
              <div>
                <label className="block text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingDown className="text-red-400" size={20} />
                  Qui sera le FLOP selon vous ?
                </label>
                <select
                  value={predictedFlopId}
                  onChange={(e) => setPredictedFlopId(e.target.value)}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Sélectionnez un joueur</option>
                  {members.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleNextStep}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
              >
                Continuer
                <ArrowLeft className="rotate-180" size={20} />
              </button>
            </div>
          )}

          {/* Étape principale : TOP et FLOP (toujours affiché) */}
          {currentStep === (session.include_predictions ? 2 : 1) && (
            <div className="space-y-6">
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
                <h2 className="text-xl font-bold text-white mb-2">🗳️ Votes obligatoires</h2>
                <p className="text-gray-300 text-sm">
                  Votez pour le meilleur et le moins bon joueur du match
                </p>
              </div>

              {/* Vote TOP */}
              <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="text-green-400" size={24} />
                  Vote TOP
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Qui est le TOP du match ?
                    </label>
                    <select
                      value={topPlayerId}
                      onChange={(e) => setTopPlayerId(e.target.value)}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Sélectionnez un joueur</option>
                      {members.map(member => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Pourquoi ? (commentaire)
                    </label>
                    <textarea
                      value={topComment}
                      onChange={(e) => setTopComment(e.target.value)}
                      placeholder="Décrivez pourquoi ce joueur mérite d'être TOP..."
                      rows={4}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Vote FLOP */}
              <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingDown className="text-red-400" size={24} />
                  Vote FLOP
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Qui est le FLOP du match ?
                    </label>
                    <select
                      value={flopPlayerId}
                      onChange={(e) => setFlopPlayerId(e.target.value)}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Sélectionnez un joueur</option>
                      {members.map(member => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Pourquoi ? (commentaire)
                    </label>
                    <textarea
                      value={flopComment}
                      onChange={(e) => setFlopComment(e.target.value)}
                      placeholder="Décrivez pourquoi ce joueur est FLOP..."
                      rows={4}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                {session.include_predictions && (
                  <button
                    onClick={handlePreviousStep}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={20} />
                    Retour
                  </button>
                )}
                
                {(session.include_best_action || session.include_worst_action) ? (
                  <button
                    onClick={handleNextStep}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  >
                    Continuer
                    <ArrowLeft className="rotate-180" size={20} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitVote}
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader className="animate-spin" size={20} />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Soumettre mon vote
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Étape : Plus beau geste (si activé) */}
          {session.include_best_action && 
           currentStep === (session.include_predictions ? 3 : 2) && (
            <div className="space-y-6">
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Sparkles className="text-blue-400 flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">✨ Plus beau geste</h2>
                    <p className="text-gray-300 text-sm">
                      L&apos;action la plus impressionnante du match (optionnel)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quel joueur a réalisé le plus beau geste ?
                    </label>
                    <select
                      value={bestActionPlayerId}
                      onChange={(e) => setBestActionPlayerId(e.target.value)}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionnez un joueur (optionnel)</option>
                      {members.map(member => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {bestActionPlayerId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Décrivez ce geste
                      </label>
                      <textarea
                        value={bestActionComment}
                        onChange={(e) => setBestActionComment(e.target.value)}
                        placeholder="Décrivez l'action impressionnante..."
                        rows={4}
                        className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePreviousStep}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={20} />
                  Retour
                </button>
                
                {session.include_worst_action ? (
                  <button
                    onClick={handleNextStep}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  >
                    Continuer
                    <ArrowLeft className="rotate-180" size={20} />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitVote}
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader className="animate-spin" size={20} />
                        Envoi...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Soumettre mon vote
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Étape : Plus beau fail (si activé) */}
          {session.include_worst_action && 
           currentStep === totalSteps && (
            <div className="space-y-6">
              <div className="bg-orange-900/30 border border-orange-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Flame className="text-orange-400 flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">🔥 Plus beau fail</h2>
                    <p className="text-gray-300 text-sm">
                      L&apos;action la plus ratée du match (optionnel)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Quel joueur a fait le plus beau fail ?
                    </label>
                    <select
                      value={worstActionPlayerId}
                      onChange={(e) => setWorstActionPlayerId(e.target.value)}
                      className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Sélectionnez un joueur (optionnel)</option>
                      {members.map(member => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {worstActionPlayerId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Décrivez ce fail
                      </label>
                      <textarea
                        value={worstActionComment}
                        onChange={(e) => setWorstActionComment(e.target.value)}
                        placeholder="Décrivez l'action ratée..."
                        rows={4}
                        className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePreviousStep}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={20} />
                  Retour
                </button>
                
                <button
                  onClick={handleSubmitVote}
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      Envoi...
                    </>
                  ) : (
                    <>
                      <Send size={20} />
                      Soumettre mon vote
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}