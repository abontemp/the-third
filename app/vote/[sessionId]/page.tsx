'use client'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/client'
import { getDisplayName } from '@/lib/utils/displayName'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Send, Loader, TrendingUp, TrendingDown, Trophy, Sparkles, Flame, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

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
  
  // Système d'étapes basé sur les noms plutôt que des numéros
  const [currentStepName, setCurrentStepName] = useState<'predictions' | 'main' | 'best_action' | 'worst_action'>('predictions')

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
          match:match_id(opponent, match_date, season:season_id(team_id))
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        toast.error('Session de vote introuvable')
        router.push('/dashboard')
        return
      }

      // Extraire le team_id depuis la réponse brute avant de typer
      const rawMatch = Array.isArray(sessionData.match) ? sessionData.match[0] : sessionData.match
      const rawSeason = rawMatch ? (Array.isArray(rawMatch.season) ? rawMatch.season[0] : rawMatch.season) : null
      const teamId = (rawSeason as { team_id: string } | null)?.team_id

      const sessionFormatted: VotingSession = {
        id: sessionData.id,
        status: sessionData.status,
        include_predictions: sessionData.include_predictions,
        include_best_action: sessionData.include_best_action,
        include_worst_action: sessionData.include_worst_action,
        match: { opponent: rawMatch?.opponent || '', match_date: rawMatch?.match_date || '' }
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
        toast.error('Vous n\'êtes pas participant à ce vote')
        router.push('/dashboard')
        return
      }

      if (participant.has_voted) {
        toast.warning('Vous avez déjà voté !')
        router.push('/dashboard')
        return
      }

      // Récupérer TOUS les membres de l'équipe (pas seulement les participants à la session)
      if (teamId) {
        const { data: teamMembersData } = await supabase
          .from('team_members')
          .select('user_id')
          .eq('team_id', teamId)

        if (teamMembersData) {
          const userIds = teamMembersData.map(m => m.user_id)
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, nickname, email')
            .in('id', userIds)

          const formattedMembers = teamMembersData
            .map(m => {
              const profile = profilesData?.find(prof => prof.id === m.user_id)
              return { user_id: m.user_id, display_name: getDisplayName(profile) }
            })
            .sort((a, b) => a.display_name.localeCompare(b.display_name))

          setMembers(formattedMembers)
        }
      }

    } catch (err) {
      logger.error('Erreur chargement:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  // Fonction pour obtenir les étapes actives dans l'ordre
  const getActiveSteps = () => {
    if (!session) return []
    
    const steps: Array<'predictions' | 'main' | 'best_action' | 'worst_action'> = []
    
    if (session.include_predictions) steps.push('predictions')
    steps.push('main') // Toujours présent (TOP/FLOP)
    if (session.include_best_action) steps.push('best_action')
    if (session.include_worst_action) steps.push('worst_action')
    
    return steps
  }

  // Fonction pour passer à l'étape suivante
  const goToNextStep = () => {
    const activeSteps = getActiveSteps()
    const currentIndex = activeSteps.indexOf(currentStepName)
    
    if (currentIndex < activeSteps.length - 1) {
      setCurrentStepName(activeSteps[currentIndex + 1])
    }
  }

  // Fonction pour revenir à l'étape précédente
  const goToPreviousStep = () => {
    const activeSteps = getActiveSteps()
    const currentIndex = activeSteps.indexOf(currentStepName)
    
    if (currentIndex > 0) {
      setCurrentStepName(activeSteps[currentIndex - 1])
    }
  }

  // Vérifier si c'est la dernière étape
  const isLastStep = () => {
    const activeSteps = getActiveSteps()
    return currentStepName === activeSteps[activeSteps.length - 1]
  }

  // Vérifier si c'est la première étape
  const isFirstStep = () => {
    const activeSteps = getActiveSteps()
    return currentStepName === activeSteps[0]
  }

  // Initialiser la première étape quand la session est chargée
  useEffect(() => {
    if (session) {
      const activeSteps = getActiveSteps()
      if (activeSteps.length > 0) {
        setCurrentStepName(activeSteps[0])
      }
    }
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNextStep = () => {
    // Validation des prédictions si on est sur cette étape
    if (currentStepName === 'predictions') {
      if (!predictedTopId || !predictedFlopId) {
        toast.warning('Veuillez faire vos prédictions TOP et FLOP')
        return
      }
      if (predictedTopId === predictedFlopId) {
        toast.warning('Les prédictions TOP et FLOP doivent être différentes')
        return
      }
    }

    goToNextStep()
  }

  const handlePreviousStep = () => {
    goToPreviousStep()
  }

  const handleSubmitVote = async () => {
    // Validations
    if (!topPlayerId || !flopPlayerId) {
      toast.warning('Veuillez sélectionner un TOP et un FLOP')
      return
    }

    if (topPlayerId === flopPlayerId) {
      toast.warning('Le TOP et le FLOP doivent être différents')
      return
    }

    if (!topComment.trim() || !flopComment.trim()) {
      toast.warning('Veuillez ajouter des commentaires pour le TOP et le FLOP')
      return
    }

    if (session?.include_best_action && bestActionPlayerId && !bestActionComment.trim()) {
      toast.warning('Veuillez ajouter un commentaire pour le plus beau geste')
      return
    }

    if (session?.include_worst_action && worstActionPlayerId && !worstActionComment.trim()) {
      toast.warning('Veuillez ajouter un commentaire pour le plus beau fail')
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

      // Ajouter les prédictions si activées ET renseignées
      if (session?.include_predictions && predictedTopId && predictedFlopId) {
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

      if (voteError) {
        logger.error('❌ Erreur insertion vote:', voteError)
        logger.error('📋 Données du vote:', voteData)
        throw voteError
      }

      logger.log('✅ Vote inséré avec succès')

      // Marquer comme ayant voté
      const { error: updateError } = await supabase
        .from('session_participants')
        .update({ has_voted: true })
        .eq('session_id', sessionId)
        .eq('user_id', user.id)

      if (updateError) {
        logger.error('❌ Erreur mise à jour participant:', updateError)
        throw updateError
      }

      logger.log('✅ Participant marqué comme ayant voté')

      toast.success('Vote enregistré avec succès !')
      router.push('/dashboard')

    } catch (err) {
      logger.error('Erreur soumission vote:', err)
      toast.error('Erreur lors de l\'enregistrement du vote')
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

  const activeSteps = getActiveSteps()
  const totalSteps = activeSteps.length
  const currentStepNumber = activeSteps.indexOf(currentStepName) + 1

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
              <span className="text-sm text-gray-400">Étape {currentStepNumber} sur {totalSteps}</span>
              <span className="text-sm text-purple-400 font-semibold">
                {Math.round((currentStepNumber / totalSteps) * 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(currentStepNumber / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Étape : Prédictions (si activé) */}
          {currentStepName === 'predictions' && (
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
          {currentStepName === 'main' && (
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
                {!isFirstStep() && (
                  <button
                    onClick={handlePreviousStep}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={20} />
                    Retour
                  </button>
                )}
                
                {!isLastStep() ? (
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
          {currentStepName === 'best_action' && (
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
                
                {!isLastStep() ? (
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
          {currentStepName === 'worst_action' && (
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