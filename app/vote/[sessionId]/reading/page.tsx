'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, ChevronRight, ThumbsDown, Trophy, Loader } from 'lucide-react'

type Vote = {
  id: string
  top_player_id: string
  top_justification: string
  flop_player_id: string
  flop_justification: string
  voter: {
    first_name?: string
    last_name?: string
    email?: string
  }
}

type VotingSession = {
  id: string
  flop_reader_id: string
  top_reader_id: string
  match: {
    opponent: string
    match_date: string
  }
}

export default function ReadingPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [votes, setVotes] = useState<Vote[]>([])
  const [currentVoteIndex, setCurrentVoteIndex] = useState(0)
  const [readingPhase, setReadingPhase] = useState<'flop' | 'top' | 'finished'>('flop')
  const [isReader, setIsReader] = useState(false)
  const [readerType, setReaderType] = useState<'flop' | 'top' | null>(null)
  const [isManager, setIsManager] = useState(false)

  useEffect(() => {
    loadReadingData()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadReadingData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          flop_reader_id,
          top_reader_id,
          match_id,
          matches (
            opponent,
            match_date,
            season_id
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData) {
        return
      }

      const matchData = Array.isArray(sessionData.matches)
        ? sessionData.matches[0]
        : sessionData.matches

      // Vérifier si l'utilisateur est manager
      if (matchData?.season_id) {
        const { data: seasonData } = await supabase
          .from('seasons')
          .select('team_id')
          .eq('id', matchData.season_id)
          .single()

        if (seasonData?.team_id) {
          const { data: memberData } = await supabase
            .from('team_members')
            .select('role')
            .eq('team_id', seasonData.team_id)
            .eq('user_id', user.id)
            .single()

          if (memberData && (memberData.role === 'manager' || memberData.role === 'creator')) {
            setIsManager(true)
          }
        }
      }

      setSession({
        id: sessionData.id,
        flop_reader_id: sessionData.flop_reader_id,
        top_reader_id: sessionData.top_reader_id,
        match: {
          opponent: matchData?.opponent || '',
          match_date: matchData?.match_date || ''
        }
      })

      if (sessionData.flop_reader_id === user.id) {
        setIsReader(true)
        setReaderType('flop')
      } else if (sessionData.top_reader_id === user.id) {
        setIsReader(true)
        setReaderType('top')
      }

      const { data: votesData } = await supabase
        .from('votes')
        .select(`
          id,
          top_player_id,
          top_justification,
          flop_player_id,
          flop_justification,
          voter_id
        `)
        .eq('session_id', sessionId)

      const votesWithProfiles = votesData?.map(vote => {
        return {
          ...vote,
          voter: {
            first_name: 'Anonyme',
            last_name: '',
            email: ''
          }
        }
      }) || []

      const shuffledVotes = [...votesWithProfiles].sort(() => Math.random() - 0.5)
      setVotes(shuffledVotes)

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNextVote = () => {
    if (currentVoteIndex < votes.length - 1) {
      setCurrentVoteIndex(currentVoteIndex + 1)
    } else {
      if (readingPhase === 'flop') {
        setReadingPhase('top')
        setCurrentVoteIndex(0)
      } else {
        setReadingPhase('finished')
      }
    }
  }

  const handleFinishReading = async () => {
    try {
      const supabase = createClient()
      
      await supabase
        .from('voting_sessions')
        .update({ status: 'closed' })
        .eq('id', sessionId)

      router.push(`/vote/${sessionId}/results`)

    } catch (err) {
      console.error('Erreur:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  if (votes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8 max-w-md text-center">
          <p className="text-white text-xl mb-4">Aucun vote à lire</p>
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

  const currentVote = votes[currentVoteIndex]
  const currentJustification = readingPhase === 'flop' 
    ? currentVote.flop_justification 
    : currentVote.top_justification

  const canControl = isManager || (isReader && readerType === readingPhase)

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
              <span>Dashboard</span>
            </button>

            <div className="text-right">
              <h2 className="text-white font-semibold">{session?.match.opponent}</h2>
              <p className="text-gray-400 text-sm">
                Lecture des votes
                {isManager && <span className="ml-2 text-yellow-400">(Manager)</span>}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Indicateur de phase */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-8">
            <div className={`flex items-center gap-2 ${readingPhase === 'flop' ? 'opacity-100' : 'opacity-40'}`}>
              <ThumbsDown className={readingPhase === 'flop' ? 'text-orange-400' : 'text-gray-500'} size={24} />
              <span className="text-white font-semibold">Phase FLOP</span>
            </div>
            <ChevronRight className="text-gray-500" size={24} />
            <div className={`flex items-center gap-2 ${readingPhase === 'top' ? 'opacity-100' : 'opacity-40'}`}>
              <Trophy className={readingPhase === 'top' ? 'text-blue-400' : 'text-gray-500'} size={24} />
              <span className="text-white font-semibold">Phase TOP</span>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-gray-400 text-sm">
              {readingPhase !== 'finished' && `Vote ${currentVoteIndex + 1} sur ${votes.length}`}
            </p>
          </div>
        </div>

        {/* Contenu selon la phase */}
        {readingPhase === 'finished' ? (
          // Écran de fin
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-12 text-center">
            <Trophy className="text-yellow-400 mx-auto mb-6" size={80} />
            <h2 className="text-4xl font-bold text-white mb-4">🎉 Lecture terminée ! 🎉</h2>
            <p className="text-gray-300 mb-8 text-lg">
              Il est temps de découvrir le podium !
            </p>
            
            {(isManager || isReader) && (
              <button
                onClick={handleFinishReading}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-8 py-4 rounded-lg text-xl font-bold hover:shadow-2xl transition transform hover:scale-105 flex items-center justify-center gap-3 mx-auto"
              >
                <Trophy size={28} />
                🏆 Voir le podium final
              </button>
            )}

            {!isManager && !isReader && (
              <p className="text-gray-400 text-sm mt-4">
                Le lecteur va annoncer le podium...
              </p>
            )}
          </div>
        ) : (
          // Lecture en cours
          <>
            <div className={`bg-gradient-to-br ${
              readingPhase === 'flop' 
                ? 'from-orange-900/30 to-red-900/30 border-orange-500/30' 
                : 'from-blue-900/30 to-purple-900/30 border-blue-500/30'
            } border rounded-2xl p-8 mb-6`}>
              <div className="flex items-center gap-3 mb-6">
                {readingPhase === 'flop' ? (
                  <ThumbsDown className="text-orange-400" size={40} />
                ) : (
                  <Trophy className="text-blue-400" size={40} />
                )}
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {readingPhase === 'flop' ? 'FLOP' : 'TOP'}
                  </h2>
                </div>
              </div>

              <div className="bg-slate-800/50 rounded-lg p-6 border border-white/10">
                <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                  {currentJustification}
                </p>
              </div>
            </div>

            {canControl && (
              <button
                onClick={handleNextVote}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg font-semibold hover:shadow-lg transition flex items-center justify-center gap-2"
              >
                {currentVoteIndex < votes.length - 1 ? (
                  <>
                    <span>Vote suivant</span>
                    <ChevronRight size={20} />
                  </>
                ) : readingPhase === 'flop' ? (
                  <>
                    <span>Passer aux votes TOP</span>
                    <ChevronRight size={20} />
                  </>
                ) : (
                  <>
                    <span>Terminer la lecture</span>
                    <Trophy size={20} />
                  </>
                )}
              </button>
            )}

            {!canControl && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                <p className="text-blue-300">
                  Suivez la lecture. Le lecteur passera au vote suivant.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}