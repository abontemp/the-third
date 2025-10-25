'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader, TrendingUp, TrendingDown, Sparkles, Flame, Trophy, Eye, EyeOff, ArrowRight } from 'lucide-react'

type Vote = {
  id: string
  user_name: string
  top_player_name: string
  top_comment: string
  flop_player_name: string
  flop_comment: string
  predicted_top_name?: string
  predicted_flop_name?: string
  best_action_player_name?: string
  best_action_comment?: string
  worst_action_player_name?: string
  worst_action_comment?: string
}

type VotingSession = {
  id: string
  status: string
  top_reader_id: string
  flop_reader_id: string
  include_predictions: boolean
  include_best_action: boolean
  include_worst_action: boolean
  match: {
    opponent: string
    match_date: string
  }
}

export default function ReadingPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [currentVoteIndex, setCurrentVoteIndex] = useState(0)
  const [isReader, setIsReader] = useState(false)
  const [readingPhase, setReadingPhase] = useState<'predictions' | 'top' | 'flop' | 'best_action' | 'worst_action' | 'done'>('predictions')
  const [showComment, setShowComment] = useState(false)

  useEffect(() => {
    loadReadingData()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReadingData = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer la session
      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          top_reader_id,
          flop_reader_id,
          include_predictions,
          include_best_action,
          include_worst_action,
          match:match_id(opponent, match_date)
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData || sessionData.status !== 'reading') {
        alert('Cette session n\'est pas en mode lecture')
        router.push('/dashboard')
        return
      }

      const sessionFormatted: VotingSession = {
        id: sessionData.id,
        status: sessionData.status,
        top_reader_id: sessionData.top_reader_id,
        flop_reader_id: sessionData.flop_reader_id,
        include_predictions: sessionData.include_predictions,
        include_best_action: sessionData.include_best_action,
        include_worst_action: sessionData.include_worst_action,
        match: Array.isArray(sessionData.match) ? sessionData.match[0] : sessionData.match
      }

      setSession(sessionFormatted)
      setIsReader(user.id === sessionFormatted.top_reader_id || user.id === sessionFormatted.flop_reader_id)

      // Définir la phase initiale
      if (sessionFormatted.include_predictions) {
        setReadingPhase('predictions')
      } else {
        setReadingPhase('top')
      }

      // Récupérer tous les votes
      const { data: votesData } = await supabase
        .from('votes')
        .select(`
          id,
          user_id,
          top_player_id,
          top_comment,
          flop_player_id,
          flop_comment,
          predicted_top_id,
          predicted_flop_id,
          best_action_player_id,
          best_action_comment,
          worst_action_player_id,
          worst_action_comment
        `)
        .eq('session_id', sessionId)

      if (!votesData || votesData.length === 0) {
        alert('Aucun vote trouvé')
        return
      }

      // Récupérer tous les user IDs uniques
      const allUserIds = new Set<string>()
      votesData.forEach(vote => {
        allUserIds.add(vote.user_id)
        allUserIds.add(vote.top_player_id)
        allUserIds.add(vote.flop_player_id)
        if (vote.predicted_top_id) allUserIds.add(vote.predicted_top_id)
        if (vote.predicted_flop_id) allUserIds.add(vote.predicted_flop_id)
        if (vote.best_action_player_id) allUserIds.add(vote.best_action_player_id)
        if (vote.worst_action_player_id) allUserIds.add(vote.worst_action_player_id)
      })

      // Récupérer les profils
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, email')
        .in('id', Array.from(allUserIds))

      const getDisplayName = (userId: string) => {
        const profile = profilesData?.find(p => p.id === userId)
        if (!profile) return 'Inconnu'
        
        if (profile.nickname?.trim()) return profile.nickname.trim()
        if (profile.first_name || profile.last_name) {
          const firstName = profile.first_name?.trim() || ''
          const lastName = profile.last_name?.trim() || ''
          return `${firstName} ${lastName}`.trim()
        }
        if (profile.email) return profile.email
        return 'Inconnu'
      }

      // Formater les votes
      const formattedVotes: Vote[] = votesData.map(vote => ({
        id: vote.id,
        user_name: getDisplayName(vote.user_id),
        top_player_name: getDisplayName(vote.top_player_id),
        top_comment: vote.top_comment,
        flop_player_name: getDisplayName(vote.flop_player_id),
        flop_comment: vote.flop_comment,
        predicted_top_name: vote.predicted_top_id ? getDisplayName(vote.predicted_top_id) : undefined,
        predicted_flop_name: vote.predicted_flop_id ? getDisplayName(vote.predicted_flop_id) : undefined,
        best_action_player_name: vote.best_action_player_id ? getDisplayName(vote.best_action_player_id) : undefined,
        best_action_comment: vote.best_action_comment || undefined,
        worst_action_player_name: vote.worst_action_player_id ? getDisplayName(vote.worst_action_player_id) : undefined,
        worst_action_comment: vote.worst_action_comment || undefined
      }))

      setVotes(formattedVotes)

    } catch (err) {
      console.error('Erreur chargement:', err)
      alert('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleNextVote = () => {
    setShowComment(false)
    if (currentVoteIndex < votes.length - 1) {
      setCurrentVoteIndex(currentVoteIndex + 1)
    } else {
      handleNextPhase()
    }
  }

  const handleNextPhase = () => {
    setCurrentVoteIndex(0)
    setShowComment(false)

    if (readingPhase === 'predictions') {
      setReadingPhase('top')
    } else if (readingPhase === 'top') {
      setReadingPhase('flop')
    } else if (readingPhase === 'flop' && session?.include_best_action) {
      setReadingPhase('best_action')
    } else if (readingPhase === 'flop' && session?.include_worst_action) {
      setReadingPhase('worst_action')
    } else if (readingPhase === 'best_action' && session?.include_worst_action) {
      setReadingPhase('worst_action')
    } else {
      setReadingPhase('done')
    }
  }

  const handleFinishReading = async () => {
    try {
      // Marquer la session comme terminée
      const { error } = await supabase
        .from('voting_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId)

      if (error) throw error

      router.push(`/vote/${sessionId}/results`)

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la finalisation')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  if (!session || votes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Erreur</h2>
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

  const currentVote = votes[currentVoteIndex]

  // Phase terminée
  if (readingPhase === 'done') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl p-8 max-w-md text-center">
          <Trophy className="text-green-400 mx-auto mb-4" size={64} />
          <h2 className="text-3xl font-bold text-white mb-4">Lecture terminée !</h2>
          <p className="text-gray-300 mb-6">
            Tous les votes ont été lus. Vous pouvez maintenant voir les résultats.
          </p>
          {isReader && (
            <button
              onClick={handleFinishReading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 rounded-lg font-semibold transition mb-4"
            >
              Voir les résultats
            </button>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg font-semibold transition"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

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
            <h1 className="text-3xl font-bold text-white mb-2">Lecture des votes</h1>
            <p className="text-gray-300">
              Match contre <span className="font-semibold text-purple-300">{session.match.opponent}</span>
            </p>
          </div>

          {/* Phase indicator */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {readingPhase === 'predictions' && (
                <>
                  <Trophy className="text-purple-400" size={24} />
                  <span className="text-white font-semibold">🔮 Prédictions</span>
                </>
              )}
              {readingPhase === 'top' && (
                <>
                  <TrendingUp className="text-green-400" size={24} />
                  <span className="text-white font-semibold">Votes TOP</span>
                </>
              )}
              {readingPhase === 'flop' && (
                <>
                  <TrendingDown className="text-red-400" size={24} />
                  <span className="text-white font-semibold">Votes FLOP</span>
                </>
              )}
              {readingPhase === 'best_action' && (
                <>
                  <Sparkles className="text-blue-400" size={24} />
                  <span className="text-white font-semibold">Plus beaux gestes</span>
                </>
              )}
              {readingPhase === 'worst_action' && (
                <>
                  <Flame className="text-orange-400" size={24} />
                  <span className="text-white font-semibold">Plus beaux fails</span>
                </>
              )}
            </div>
            <span className="text-gray-400">
              Vote {currentVoteIndex + 1} / {votes.length}
            </span>
          </div>

          {/* Vote card */}
          <div className={`rounded-xl p-6 border mb-6 ${
            readingPhase === 'predictions' ? 'bg-purple-900/30 border-purple-500/30' :
            readingPhase === 'top' ? 'bg-green-900/30 border-green-500/30' :
            readingPhase === 'flop' ? 'bg-red-900/30 border-red-500/30' :
            readingPhase === 'best_action' ? 'bg-blue-900/30 border-blue-500/30' :
            'bg-orange-900/30 border-orange-500/30'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                Vote de {currentVote.user_name}
              </h3>
            </div>

            {/* Contenu selon la phase */}
            {readingPhase === 'predictions' && (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Prédiction TOP</p>
                  <p className="text-white text-xl font-semibold">
                    {currentVote.predicted_top_name || 'Aucune prédiction'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Prédiction FLOP</p>
                  <p className="text-white text-xl font-semibold">
                    {currentVote.predicted_flop_name || 'Aucune prédiction'}
                  </p>
                </div>
              </div>
            )}

            {readingPhase === 'top' && (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">A voté pour</p>
                  <p className="text-green-400 text-2xl font-bold">
                    {currentVote.top_player_name}
                  </p>
                </div>
                
                <div>
                  <button
                    onClick={() => setShowComment(!showComment)}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-2"
                  >
                    {showComment ? <EyeOff size={18} /> : <Eye size={18} />}
                    {showComment ? 'Masquer le commentaire' : 'Voir le commentaire'}
                  </button>
                  
                  {showComment && (
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-white/10">
                      <p className="text-white italic">&ldquo;{currentVote.top_comment}&rdquo;</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {readingPhase === 'flop' && (
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-sm mb-1">A voté pour</p>
                  <p className="text-red-400 text-2xl font-bold">
                    {currentVote.flop_player_name}
                  </p>
                </div>
                
                <div>
                  <button
                    onClick={() => setShowComment(!showComment)}
                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-2"
                  >
                    {showComment ? <EyeOff size={18} /> : <Eye size={18} />}
                    {showComment ? 'Masquer le commentaire' : 'Voir le commentaire'}
                  </button>
                  
                  {showComment && (
                    <div className="bg-slate-700/50 rounded-lg p-4 border border-white/10">
                      <p className="text-white italic">&ldquo;{currentVote.flop_comment}&rdquo;</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {readingPhase === 'best_action' && (
              <div className="space-y-4">
                {currentVote.best_action_player_name ? (
                  <>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Joueur</p>
                      <p className="text-blue-400 text-2xl font-bold">
                        {currentVote.best_action_player_name}
                      </p>
                    </div>
                    
                    <div>
                      <button
                        onClick={() => setShowComment(!showComment)}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-2"
                      >
                        {showComment ? <EyeOff size={18} /> : <Eye size={18} />}
                        {showComment ? 'Masquer la description' : 'Voir la description'}
                      </button>
                      
                      {showComment && currentVote.best_action_comment && (
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-white/10">
                          <p className="text-white italic">&ldquo;{currentVote.best_action_comment}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-400 italic">Aucun vote pour le plus beau geste</p>
                )}
              </div>
            )}

            {readingPhase === 'worst_action' && (
              <div className="space-y-4">
                {currentVote.worst_action_player_name ? (
                  <>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Joueur</p>
                      <p className="text-orange-400 text-2xl font-bold">
                        {currentVote.worst_action_player_name}
                      </p>
                    </div>
                    
                    <div>
                      <button
                        onClick={() => setShowComment(!showComment)}
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition mb-2"
                      >
                        {showComment ? <EyeOff size={18} /> : <Eye size={18} />}
                        {showComment ? 'Masquer la description' : 'Voir la description'}
                      </button>
                      
                      {showComment && currentVote.worst_action_comment && (
                        <div className="bg-slate-700/50 rounded-lg p-4 border border-white/10">
                          <p className="text-white italic">&ldquo;{currentVote.worst_action_comment}&rdquo;</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-400 italic">Aucun vote pour le plus beau fail</p>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <button
            onClick={handleNextVote}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2"
          >
            {currentVoteIndex < votes.length - 1 ? (
              <>
                Vote suivant
                <ArrowRight size={20} />
              </>
            ) : (
              <>
                {readingPhase === 'predictions' ? 'Passer aux votes TOP' :
                 readingPhase === 'top' ? 'Passer aux votes FLOP' :
                 readingPhase === 'flop' && session.include_best_action ? 'Passer aux plus beaux gestes' :
                 readingPhase === 'flop' && session.include_worst_action ? 'Passer aux plus beaux fails' :
                 readingPhase === 'best_action' ? 'Passer aux plus beaux fails' :
                 'Terminer la lecture'}
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}