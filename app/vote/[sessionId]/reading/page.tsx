'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { logger } from '@/lib/utils/logger'
import { sendPushToUsers } from '@/lib/utils/sendPush'
import { getDisplayName } from '@/lib/utils/displayName'
import { ArrowLeft, Loader, ThumbsDown, Trophy, Sparkles, Flame } from 'lucide-react'
import { toast } from 'sonner'

type Vote = {
  id: string
  voter_name: string
  top_player_id: string
  top_player_name: string
  top_comment: string
  flop_player_id: string
  flop_player_name: string
  flop_comment: string
  best_action_player_id?: string
  best_action_player_name?: string
  best_action_comment?: string
  worst_action_player_id?: string
  worst_action_player_name?: string
  worst_action_comment?: string
}

type VotingSession = {
  id: string
  flop_reader_id: string | null
  top_reader_id: string | null
  include_best_action: boolean
  include_worst_action: boolean
  match: {
    opponent: string
    match_date: string
  }
}

// Shuffle déterministe : même seed = même ordre pour tous les utilisateurs
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function shuffleArray<T>(array: T[], seed: string): T[] {
  const shuffled = [...array]
  const rand = seededRandom(hashString(seed))
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export default function ReadingPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params?.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [readingPhase, setReadingPhase] = useState<'flop' | 'top' | 'best_action' | 'worst_action' | 'finished'>('flop')
  const [isManager, setIsManager] = useState(false)
  const [isReader, setIsReader] = useState(false)
  const [savingQuote, setSavingQuote] = useState<string | null>(null)
  const [savedQuotes, setSavedQuotes] = useState<Set<string>>(new Set())
  const [teamId, setTeamId] = useState<string | null>(null)

  useEffect(() => {
    loadReadingData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReadingData = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const savedTeamId = localStorage.getItem('selectedTeamId')

      // Récupérer la session
      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          flop_reader_id,
          top_reader_id,
          include_best_action,
          include_worst_action,
          matches (
            opponent,
            match_date,
            seasons (
              team_id
            )
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        toast.error('Session introuvable')
        router.push('/dashboard')
        return
      }

      const matchData = Array.isArray(sessionData.matches) ? sessionData.matches[0] : sessionData.matches
      const seasonData = Array.isArray(matchData?.seasons) ? matchData?.seasons[0] : matchData?.seasons

      // Récupérer le team_id depuis la session (via match → season) ou localStorage en fallback
      const resolvedTeamId = seasonData?.team_id || savedTeamId
      if (resolvedTeamId) {
        setTeamId(resolvedTeamId)
        logger.log('✅ Team ID:', resolvedTeamId)
      } else {
        logger.error('❌ Impossible de récupérer le team_id')
        toast.error('Erreur: impossible de déterminer l\'équipe')
        router.push('/dashboard')
        return
      }

      // Vérifier si l'utilisateur est manager
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('team_id', resolvedTeamId)
        .single()

      const isUserManager = membership?.role === 'manager' || membership?.role === 'creator'
      setIsManager(isUserManager)

      // Vérifier si l'utilisateur est lecteur
      const isUserReader = sessionData.flop_reader_id === user.id || sessionData.top_reader_id === user.id
      setIsReader(isUserReader)

      logger.log('👤 User:', user.id)
      logger.log('🎭 Manager:', isUserManager)
      logger.log('📖 Lecteur:', isUserReader)

      setSession({
        id: sessionData.id,
        flop_reader_id: sessionData.flop_reader_id,
        top_reader_id: sessionData.top_reader_id,
        include_best_action: sessionData.include_best_action,
        include_worst_action: sessionData.include_worst_action,
        match: {
          opponent: matchData?.opponent || '',
          match_date: matchData?.match_date || ''
        }
      })

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
          best_action_player_id,
          best_action_comment,
          worst_action_player_id,
          worst_action_comment
        `)
        .eq('session_id', sessionId)

      if (!votesData || votesData.length === 0) {
        toast.warning('Aucun vote trouvé')
        router.push('/dashboard')
        return
      }

      // Récupérer tous les profils nécessaires
      const userIds = new Set<string>()
      votesData.forEach(v => {
        userIds.add(v.user_id)
        userIds.add(v.top_player_id)
        userIds.add(v.flop_player_id)
        if (v.best_action_player_id) userIds.add(v.best_action_player_id)
        if (v.worst_action_player_id) userIds.add(v.worst_action_player_id)
      })

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .in('id', Array.from(userIds))

      const profilesMap: Record<string, string> = {}
      profilesData?.forEach(p => {
        profilesMap[p.id] = getDisplayName(p)
      })

      // Formater et MÉLANGER les votes
      const formattedVotes: Vote[] = shuffleArray(votesData.map(v => ({
        id: v.id,
        voter_name: profilesMap[v.user_id] || 'Anonyme',
        top_player_id: v.top_player_id,
        top_player_name: profilesMap[v.top_player_id] || 'Inconnu',
        top_comment: v.top_comment,
        flop_player_id: v.flop_player_id,
        flop_player_name: profilesMap[v.flop_player_id] || 'Inconnu',
        flop_comment: v.flop_comment,
        best_action_player_id: v.best_action_player_id || undefined,
        best_action_player_name: v.best_action_player_id ? profilesMap[v.best_action_player_id] : undefined,
        best_action_comment: v.best_action_comment || undefined,
        worst_action_player_id: v.worst_action_player_id || undefined,
        worst_action_player_name: v.worst_action_player_id ? profilesMap[v.worst_action_player_id] : undefined,
        worst_action_comment: v.worst_action_comment || undefined
      })), sessionId)

      setVotes(formattedVotes)

    } catch (err) {
      logger.error('Erreur:', err)
      toast.error('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const goToNextPhase = () => {
    if (readingPhase === 'flop') {
      setReadingPhase('top')
    } else if (readingPhase === 'top') {
      if (session?.include_best_action) setReadingPhase('best_action')
      else if (session?.include_worst_action) setReadingPhase('worst_action')
      else setReadingPhase('finished')
    } else if (readingPhase === 'best_action') {
      if (session?.include_worst_action) setReadingPhase('worst_action')
      else setReadingPhase('finished')
    } else if (readingPhase === 'worst_action') {
      setReadingPhase('finished')
    }
  }

  const handleFinishReading = async () => {
    try {
      const { error } = await supabase
        .from('voting_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId)

      if (error) throw error

      // Notifier tous les participants que les résultats sont disponibles
      const { data: participants } = await supabase
        .from('session_participants')
        .select('user_id')
        .eq('session_id', sessionId)

      if (participants?.length) {
        sendPushToUsers(
          participants.map(p => p.user_id),
          {
            title: '🏆 Résultats disponibles !',
            body: `La lecture est terminée. Découvre le podium du match vs ${session?.match.opponent} !`,
            url: `/vote/${sessionId}/results`,
          }
        )
      }

      toast.success('Lecture terminée ! Direction les résultats')
      router.push(`/vote/${sessionId}/results`)
    } catch (err) {
      logger.error('Erreur:', err)
      toast.error('Erreur lors de la finalisation')
    }
  }

  const handleSaveQuote = async (
    voteId: string, 
    playerId: string, 
    comment: string, 
    type: 'top' | 'flop' | 'best_action' | 'worst_action'
  ) => {
    if (!canControl) {
      toast.warning('Seul le lecteur ou un manager peut sauvegarder des citations')
      return
    }

    if (!teamId) {
      toast.error('Impossible de sauvegarder : team_id introuvable')
      return
    }

    const quoteKey = `${voteId}-${type}`

    try {
      setSavingQuote(quoteKey)

      // Convertir le type pour memorable_quotes (qui n'accepte que 'top' ou 'flop')
      const savedType: 'top' | 'flop' =
        type === 'best_action' ? 'top' :
        type === 'worst_action' ? 'flop' :
        type

      // Vérifier si la citation existe déjà
      const { data: existing } = await supabase
        .from('memorable_quotes')
        .select('id')
        .eq('vote_id', voteId)
        .eq('vote_type', savedType)
        .maybeSingle()

      if (existing) {
        setSavedQuotes(prev => new Set(prev).add(quoteKey))
        return
      }

      // Récupérer le voter_id depuis le vote
      const { data: voteData } = await supabase
        .from('votes')
        .select('user_id')
        .eq('id', voteId)
        .single()

      if (!voteData) return

      // Sauvegarder la citation
      const { error } = await supabase
        .from('memorable_quotes')
        .insert([{
          team_id: teamId,
          vote_id: voteId,
          voter_id: voteData.user_id,
          player_id: playerId,
          comment: comment,
          vote_type: savedType
        }])

      if (error) throw error

      setSavedQuotes(prev => new Set(prev).add(quoteKey))

    } catch (err) {
      logger.error('Erreur:', err)
      toast.error('Erreur lors de la sauvegarde de la citation')
    } finally {
      setSavingQuote(null)
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
        <div className="text-center">
          <p className="text-white text-xl mb-4">Aucune donnée disponible</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  const canControl = isManager || isReader

  const phaseConfig = {
    flop: {
      label: 'FLOP',
      icon: <ThumbsDown className="text-orange-400 mx-auto mb-3" size={56} />,
      iconSmall: <ThumbsDown className="text-orange-400 shrink-0" size={20} />,
      border: 'border-orange-500',
      bg: 'from-orange-900/40 to-red-900/40',
      tag: 'bg-orange-500/20 text-orange-300',
      nextLabel: session?.include_best_action ? 'Passer aux plus beaux gestes' :
                 session?.include_worst_action ? 'Passer aux plus beaux fails' :
                 'Passer aux TOP',
    },
    top: {
      label: 'TOP',
      icon: <Trophy className="text-blue-400 mx-auto mb-3" size={56} />,
      iconSmall: <Trophy className="text-blue-400 shrink-0" size={20} />,
      border: 'border-blue-500',
      bg: 'from-blue-900/40 to-purple-900/40',
      tag: 'bg-blue-500/20 text-blue-300',
      nextLabel: session?.include_best_action ? 'Passer aux plus beaux gestes' :
                 session?.include_worst_action ? 'Passer aux plus beaux fails' :
                 'Terminer la lecture',
    },
    best_action: {
      label: 'PLUS BEAU GESTE',
      icon: <Sparkles className="text-amber-400 mx-auto mb-3" size={56} />,
      iconSmall: <Sparkles className="text-amber-400 shrink-0" size={20} />,
      border: 'border-amber-500',
      bg: 'from-amber-900/40 to-yellow-900/40',
      tag: 'bg-amber-500/20 text-amber-300',
      nextLabel: session?.include_worst_action ? 'Passer aux plus beaux fails' : 'Terminer la lecture',
    },
    worst_action: {
      label: 'PLUS BEAU FAIL',
      icon: <Flame className="text-pink-400 mx-auto mb-3" size={56} />,
      iconSmall: <Flame className="text-pink-400 shrink-0" size={20} />,
      border: 'border-pink-500',
      bg: 'from-pink-900/40 to-red-900/40',
      tag: 'bg-pink-500/20 text-pink-300',
      nextLabel: 'Terminer la lecture',
    },
  }

  const getVoteContent = (vote: Vote, phase: typeof readingPhase) => {
    if (phase === 'flop') return { player: vote.flop_player_name, comment: vote.flop_comment, playerId: vote.flop_player_id }
    if (phase === 'top') return { player: vote.top_player_name, comment: vote.top_comment, playerId: vote.top_player_id }
    if (phase === 'best_action') return { player: vote.best_action_player_name, comment: vote.best_action_comment, playerId: vote.best_action_player_id }
    if (phase === 'worst_action') return { player: vote.worst_action_player_name, comment: vote.worst_action_comment, playerId: vote.worst_action_player_id }
    return null
  }

  const visibleVotes = readingPhase !== 'finished'
    ? votes.filter(v => {
        if (readingPhase === 'best_action') return !!v.best_action_comment
        if (readingPhase === 'worst_action') return !!v.worst_action_comment
        return true
      })
    : []

  if (readingPhase === 'finished') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-12 text-center max-w-lg w-full">
          <Trophy className="text-yellow-400 mx-auto mb-6" size={80} />
          <h2 className="text-4xl font-bold text-white mb-4">Lecture terminée !</h2>
          <p className="text-gray-300 mb-8 text-lg">Il est temps de découvrir le podium !</p>
          {canControl && (
            <button
              onClick={handleFinishReading}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition"
            >
              Voir les résultats 🏆
            </button>
          )}
          {!canControl && <p className="text-gray-500 text-sm">En attente du manager…</p>}
        </div>
      </div>
    )
  }

  const config = phaseConfig[readingPhase]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Dashboard</span>
            </button>
            <div className="text-right">
              <h2 className="text-white font-semibold">{session.match.opponent}</h2>
              <p className="text-gray-400 text-xs">
                {new Date(session.match.match_date).toLocaleDateString('fr-FR')}
                {isManager && <span className="ml-2 text-yellow-400">· Manager</span>}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* BANNIÈRE DE PHASE */}
        <div className={`bg-gradient-to-r ${config.bg} border-2 ${config.border} rounded-2xl p-6 text-center mb-8`}>
          {config.icon}
          <h2 className="text-3xl font-bold text-white mb-1">{config.label}</h2>
          <p className="text-gray-400 text-sm">{visibleVotes.length} vote{visibleVotes.length > 1 ? 's' : ''}</p>
        </div>

        {/* LISTE DE TOUS LES VOTES */}
        <div className="space-y-4 mb-8">
          {visibleVotes.map((vote, index) => {
            const content = getVoteContent(vote, readingPhase)
            if (!content?.player || !content?.comment) return null
            const quoteKey = `${vote.id}-${readingPhase}`
            const isSaved = savedQuotes.has(quoteKey)
            const isSaving = savingQuote === quoteKey

            return (
              <div
                key={vote.id}
                className={`bg-slate-800/60 border ${config.border} border-opacity-30 rounded-xl p-5`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-gray-500 text-sm font-mono w-6 shrink-0 pt-0.5">{index + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {config.iconSmall}
                      <span className="text-white font-bold text-lg">{content.player}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${config.tag}`}>{config.label}</span>
                    </div>
                    <p className="text-gray-200 text-base leading-relaxed italic">"{content.comment}"</p>
                  </div>
                </div>

                {canControl && content.playerId && (
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => handleSaveQuote(vote.id, content.playerId!, content.comment!, readingPhase as 'top' | 'flop' | 'best_action' | 'worst_action')}
                      disabled={isSaving || isSaved}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                        isSaved
                          ? 'bg-yellow-600/30 text-yellow-400 cursor-default'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white disabled:opacity-50'
                      }`}
                    >
                      <span>{isSaved ? '★' : '⭐'}</span>
                      <span>{isSaved ? 'Dans le Hall of Fame' : 'Hall of Fame'}</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* BOUTON PHASE SUIVANTE */}
        {canControl ? (
          <button
            onClick={goToNextPhase}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-xl font-semibold text-lg transition flex items-center justify-center gap-2"
          >
            {readingPhase === 'flop' ? 'Passer aux TOP →' : config.nextLabel + ' →'}
          </button>
        ) : (
          <p className="text-center text-gray-500 text-sm">Seul le lecteur ou un manager peut avancer</p>
        )}
      </div>
    </div>
  )
}