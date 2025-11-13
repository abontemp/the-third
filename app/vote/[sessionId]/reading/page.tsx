'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader, ThumbsDown, Trophy, Sparkles, Flame, ChevronRight } from 'lucide-react'

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

// Fonction pour mélanger un tableau
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
  const [currentVoteIndex, setCurrentVoteIndex] = useState(0)
  const [readingPhase, setReadingPhase] = useState<'flop' | 'top' | 'best_action' | 'worst_action' | 'finished'>('flop')
  const [isManager, setIsManager] = useState(false)
  const [isReader, setIsReader] = useState(false)
  const [savingQuote, setSavingQuote] = useState(false)
  const [teamId, setTeamId] = useState<string>('')

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
            season_id
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        alert('Session introuvable')
        router.push('/dashboard')
        return
      }

      const matchData = Array.isArray(sessionData.matches) ? sessionData.matches[0] : sessionData.matches

      // Vérifier si l'utilisateur est manager
      const { data: membership } = await supabase
        .from('team_members')
        .select('role, team_id')
        .eq('user_id', user.id)
        .single()

      const isUserManager = membership?.role === 'manager' || membership?.role === 'creator'
      setIsManager(isUserManager)
      
      if (membership?.team_id) {
        setTeamId(membership.team_id)
      }

      // Vérifier si l'utilisateur est lecteur
      const isUserReader = sessionData.flop_reader_id === user.id || sessionData.top_reader_id === user.id
      setIsReader(isUserReader)

      console.log('👤 User:', user.id)
      console.log('🎭 Manager:', isUserManager)
      console.log('📖 Lecteur:', isUserReader)

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
        alert('Aucun vote trouvé')
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
        profilesMap[p.id] = p.nickname || 
                           (p.first_name && p.last_name 
                             ? `${p.first_name} ${p.last_name}` 
                             : 'Joueur')
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
      })))

      setVotes(formattedVotes)

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  const handleNextVote = () => {
    if (currentVoteIndex < votes.length - 1) {
      setCurrentVoteIndex(currentVoteIndex + 1)
    } else {
      // Fin de cette phase, passer à la suivante
      if (readingPhase === 'flop') {
        setReadingPhase('top')
        setCurrentVoteIndex(0)
      } else if (readingPhase === 'top') {
        // Vérifier s'il y a une phase "plus beau geste"
        if (session?.include_best_action) {
          setReadingPhase('best_action')
          setCurrentVoteIndex(0)
        } else if (session?.include_worst_action) {
          setReadingPhase('worst_action')
          setCurrentVoteIndex(0)
        } else {
          setReadingPhase('finished')
        }
      } else if (readingPhase === 'best_action') {
        // Vérifier s'il y a une phase "plus beau fail"
        if (session?.include_worst_action) {
          setReadingPhase('worst_action')
          setCurrentVoteIndex(0)
        } else {
          setReadingPhase('finished')
        }
      } else if (readingPhase === 'worst_action') {
        setReadingPhase('finished')
      }
    }
  }

  const handleFinishReading = async () => {
    try {
      const { error } = await supabase
        .from('voting_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId)

      if (error) throw error

      alert('Lecture terminée ! Direction les résultats 🎉')
      router.push(`/vote/${sessionId}/results`)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la finalisation')
    }
  }

  const handleSaveQuote = async (
    voteId: string, 
    playerId: string, 
    comment: string, 
    type: 'top' | 'flop' | 'best_action' | 'worst_action'
  ) => {
    if (!canControl) {
      alert('Seul le lecteur ou un manager peut sauvegarder des citations')
      return
    }

    try {
      setSavingQuote(true)

      // Vérifier si la citation existe déjà
      const { data: existing } = await supabase
.from('memorable_quotes')
        .select('id')
        .eq('vote_id', voteId)
        .eq('vote_type', type === 'best_action' || type === 'worst_action' ? type : type)
        .single()

      if (existing) {
        alert('Cette citation est déjà dans le Hall of Fame !')
        return
      }

      // Récupérer le voter_id depuis le vote
      const { data: voteData } = await supabase
        .from('votes')
        .select('user_id')
        .eq('id', voteId)
        .single()

      if (!voteData) {
        alert('Vote introuvable')
        return
      }

      // Convertir le type pour saved_quotes (qui n'accepte que 'top' ou 'flop')
      const savedType: 'top' | 'flop' = 
        type === 'best_action' ? 'top' : 
        type === 'worst_action' ? 'flop' : 
        type

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

      alert('⭐ Citation ajoutée au Hall of Fame !')

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la sauvegarde de la citation')
    } finally {
      setSavingQuote(false)
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

  // Contrôle : Manager ou Lecteur peut naviguer
  const canControl = isManager || isReader
  const currentVote = votes[currentVoteIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
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
              <p className="text-gray-400 text-sm">
                Lecture des votes
                {isManager && <span className="ml-2 text-yellow-400">(Manager)</span>}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {readingPhase === 'finished' ? (
          // ÉCRAN DE FIN
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-12 text-center">
            <Trophy className="text-yellow-400 mx-auto mb-6" size={80} />
            <h2 className="text-4xl font-bold text-white mb-4">🎉 Lecture terminée ! 🎉</h2>
            <p className="text-gray-300 mb-8 text-lg">
              Il est temps de découvrir le podium !
            </p>

            {canControl && (
              <button
                onClick={handleFinishReading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition"
              >
                Voir les résultats 🏆
              </button>
            )}
          </div>
        ) : (
          <>
            {/* BANNIÈRE DE PHASE */}
            <div className="mb-8">
              {readingPhase === 'flop' && (
                <div className="bg-gradient-to-r from-orange-900/50 to-red-900/50 border-2 border-orange-500 rounded-2xl p-6 text-center">
                  <ThumbsDown className="text-orange-400 mx-auto mb-3" size={64} />
                  <h2 className="text-4xl font-bold text-white mb-2">PHASE FLOP</h2>
                  <p className="text-gray-300">Lecture des votes FLOP</p>
                  <p className="text-orange-400 font-semibold mt-2">Vote {currentVoteIndex + 1}/{votes.length}</p>
                </div>
              )}

              {readingPhase === 'top' && (
                <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-2 border-blue-500 rounded-2xl p-6 text-center">
                  <Trophy className="text-blue-400 mx-auto mb-3" size={64} />
                  <h2 className="text-4xl font-bold text-white mb-2">PHASE TOP</h2>
                  <p className="text-gray-300">Lecture des votes TOP</p>
                  <p className="text-blue-400 font-semibold mt-2">Vote {currentVoteIndex + 1}/{votes.length}</p>
                </div>
              )}

              {readingPhase === 'best_action' && (
                <div className="bg-gradient-to-r from-green-900/50 to-emerald-900/50 border-2 border-green-500 rounded-2xl p-6 text-center">
                  <Sparkles className="text-green-400 mx-auto mb-3" size={64} />
                  <h2 className="text-4xl font-bold text-white mb-2">PLUS BEAU GESTE</h2>
                  <p className="text-gray-300">Lecture des plus beaux gestes</p>
                  <p className="text-green-400 font-semibold mt-2">Vote {currentVoteIndex + 1}/{votes.length}</p>
                </div>
              )}

              {readingPhase === 'worst_action' && (
                <div className="bg-gradient-to-r from-pink-900/50 to-red-900/50 border-2 border-pink-500 rounded-2xl p-6 text-center">
                  <Flame className="text-pink-400 mx-auto mb-3" size={64} />
                  <h2 className="text-4xl font-bold text-white mb-2">PLUS BEAU FAIL</h2>
                  <p className="text-gray-300">Lecture des plus beaux fails</p>
                  <p className="text-pink-400 font-semibold mt-2">Vote {currentVoteIndex + 1}/{votes.length}</p>
                </div>
              )}
            </div>

            {/* CONTENU DU VOTE */}
            <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-8">
              {readingPhase === 'flop' && (
                <>
                  <div className="text-center mb-6">
                    <ThumbsDown className="text-orange-400 mx-auto mb-3" size={48} />
                    <h3 className="text-3xl font-bold text-white mb-2">
                      {currentVote.flop_player_name}
                    </h3>
                    <p className="text-gray-400">Vote FLOP</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-6">
                    <p className="text-xl text-white leading-relaxed mb-4">
                      {currentVote.flop_comment}
                    </p>
                    
                    {canControl && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveQuote(currentVote.id, currentVote.flop_player_id, currentVote.flop_comment, 'flop')}
                          disabled={savingQuote}
                          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                        >
                          <span>⭐</span>
                          <span>Hall of Fame</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {readingPhase === 'top' && (
                <>
                  <div className="text-center mb-6">
                    <Trophy className="text-blue-400 mx-auto mb-3" size={48} />
                    <h3 className="text-3xl font-bold text-white mb-2">
                      {currentVote.top_player_name}
                    </h3>
                    <p className="text-gray-400">Vote TOP</p>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-6">
                    <p className="text-xl text-white leading-relaxed mb-4">
                      {currentVote.top_comment}
                    </p>
                    
                    {canControl && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveQuote(currentVote.id, currentVote.top_player_id, currentVote.top_comment, 'top')}
                          disabled={savingQuote}
                          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                        >
                          <span>⭐</span>
                          <span>Hall of Fame</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {readingPhase === 'best_action' && (
                <>
                  {currentVote.best_action_player_name && currentVote.best_action_comment && currentVote.best_action_player_id ? (
                    <>
                      <div className="text-center mb-6">
                        <Sparkles className="text-green-400 mx-auto mb-3" size={48} />
                        <h3 className="text-3xl font-bold text-white mb-2">
                          {currentVote.best_action_player_name}
                        </h3>
                        <p className="text-gray-400">Plus beau geste</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-xl p-6">
                        <p className="text-xl text-white leading-relaxed mb-4">
                          {currentVote.best_action_comment}
                        </p>
                        
                        {canControl && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleSaveQuote(currentVote.id, currentVote.best_action_player_id!, currentVote.best_action_comment!, 'best_action')}
                              disabled={savingQuote}
                              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                            >
                              <span>⭐</span>
                              <span>Hall of Fame</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      <p>Aucun plus beau geste pour ce vote</p>
                    </div>
                  )}
                </>
              )}

              {readingPhase === 'worst_action' && (
                <>
                  {currentVote.worst_action_player_name && currentVote.worst_action_comment && currentVote.worst_action_player_id ? (
                    <>
                      <div className="text-center mb-6">
                        <Flame className="text-pink-400 mx-auto mb-3" size={48} />
                        <h3 className="text-3xl font-bold text-white mb-2">
                          {currentVote.worst_action_player_name}
                        </h3>
                        <p className="text-gray-400">Plus beau fail</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-xl p-6">
                        <p className="text-xl text-white leading-relaxed mb-4">
                          {currentVote.worst_action_comment}
                        </p>
                        
                        {canControl && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleSaveQuote(currentVote.id, currentVote.worst_action_player_id!, currentVote.worst_action_comment!, 'worst_action')}
                              disabled={savingQuote}
                              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-semibold transition disabled:opacity-50"
                            >
                              <span>⭐</span>
                              <span>Hall of Fame</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-gray-400 py-8">
                      <p>Aucun plus beau fail pour ce vote</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* BOUTON SUIVANT */}
            {canControl && (
              <div className="mt-8">
                <button
                  onClick={handleNextVote}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-lg font-semibold text-lg transition flex items-center justify-center gap-2"
                >
                  {currentVoteIndex < votes.length - 1 ? 'Vote suivant' : 
                   readingPhase === 'flop' ? 'Passer aux TOP' :
                   readingPhase === 'top' && session.include_best_action ? 'Passer aux plus beaux gestes' :
                   readingPhase === 'top' && session.include_worst_action ? 'Passer aux plus beaux fails' :
                   readingPhase === 'best_action' && session.include_worst_action ? 'Passer aux plus beaux fails' :
                   'Terminer la lecture'}
                  <ChevronRight size={20} />
                </button>
              </div>
            )}

            {!canControl && (
              <div className="mt-8 text-center text-gray-400">
                <p>Seul le lecteur ou un manager peut avancer</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}