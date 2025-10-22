'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trophy, ThumbsDown, ArrowLeft, Loader } from 'lucide-react'

type VoteResult = {
  player_id: string
  player_name: string
  vote_count: number
  percentage: number
  displayRank: number
}

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [topResults, setTopResults] = useState<VoteResult[]>([])
  const [flopResults, setFlopResults] = useState<VoteResult[]>([])
  const [matchInfo, setMatchInfo] = useState<{ opponent: string; date: string } | null>(null)

  useEffect(() => {
    loadResults()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadResults = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          matches (
            opponent,
            match_date
          )
        `)
        .eq('id', sessionId)
        .single()

      if (sessionData) {
        const match = Array.isArray(sessionData.matches) 
          ? sessionData.matches[0] 
          : sessionData.matches
        
        setMatchInfo({
          opponent: match?.opponent || '',
          date: match?.match_date || ''
        })
      }

      const { data: votes } = await supabase
        .from('votes')
        .select('top_player_id, flop_player_id')
        .eq('session_id', sessionId)

      if (!votes || votes.length === 0) {
        setLoading(false)
        return
      }

      const topCounts: Record<string, number> = {}
      votes.forEach(vote => {
        if (vote.top_player_id) {
          topCounts[vote.top_player_id] = (topCounts[vote.top_player_id] || 0) + 1
        }
      })

      const flopCounts: Record<string, number> = {}
      votes.forEach(vote => {
        if (vote.flop_player_id) {
          flopCounts[vote.flop_player_id] = (flopCounts[vote.flop_player_id] || 0) + 1
        }
      })

      const allPlayerIds = [...new Set([...Object.keys(topCounts), ...Object.keys(flopCounts)])]
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', allPlayerIds)

      const playerNames: Record<string, string> = {}
      profiles?.forEach(profile => {
        playerNames[profile.id] = profile.first_name && profile.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : profile.email || 'Joueur inconnu'
      })

      const topResultsArray = Object.entries(topCounts)
        .map(([playerId, count]) => ({
          player_id: playerId,
          player_name: playerNames[playerId] || 'Joueur inconnu',
          vote_count: count,
          percentage: Math.round((count / votes.length) * 100),
          displayRank: 0
        }))
        .sort((a, b) => b.vote_count - a.vote_count)

      assignDisplayRanks(topResultsArray)

      const flopResultsArray = Object.entries(flopCounts)
        .map(([playerId, count]) => ({
          player_id: playerId,
          player_name: playerNames[playerId] || 'Joueur inconnu',
          vote_count: count,
          percentage: Math.round((count / votes.length) * 100),
          displayRank: 0
        }))
        .sort((a, b) => b.vote_count - a.vote_count)

      assignDisplayRanks(flopResultsArray)

      setTopResults(topResultsArray.slice(0, 5))
      setFlopResults(flopResultsArray.slice(0, 5))

    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const assignDisplayRanks = (results: VoteResult[]) => {
    let currentDisplayRank = 1
    
    for (let i = 0; i < results.length; i++) {
      if (i > 0 && results[i].vote_count === results[i - 1].vote_count) {
        results[i].displayRank = results[i - 1].displayRank
      } else {
        results[i].displayRank = currentDisplayRank
      }
      currentDisplayRank++
    }
  }

  const groupByDisplayRank = (results: VoteResult[]) => {
    const grouped: { [key: number]: VoteResult[] } = {}
    results.forEach(result => {
      if (result.displayRank <= 3) {
        if (!grouped[result.displayRank]) {
          grouped[result.displayRank] = []
        }
        grouped[result.displayRank].push(result)
      }
    })
    return grouped
  }

  const getPodiumHeight = (rank: number) => {
    if (rank === 1) return 'h-64'
    if (rank === 2) return 'h-48'
    return 'h-32'
  }

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-yellow-600'
    if (rank === 2) return 'from-gray-300 to-gray-500'
    return 'from-orange-400 to-orange-600'
  }

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    return '🥉'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  const topGrouped = groupByDisplayRank(topResults)
  const flopGrouped = groupByDisplayRank(flopResults)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-white hover:text-blue-400 transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white">Résultats du vote</h1>
            {matchInfo && (
              <p className="text-gray-400">
                {matchInfo.opponent} - {new Date(matchInfo.date).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Trophy className="text-yellow-400" size={32} />
            <h2 className="text-3xl font-bold text-white">Top du match</h2>
          </div>

          {topResults.length > 0 ? (
            <div className="flex items-end justify-center gap-8 mb-8">
              {[2, 1, 3].map(position => {
                const playersAtPosition = topGrouped[position] || []
                if (playersAtPosition.length === 0) return null

                const isMultiple = playersAtPosition.length > 1
                const totalWidth = isMultiple ? playersAtPosition.length * 220 : 220

                return (
                  <div
                    key={position}
                    className="flex flex-col items-center"
                    style={{ 
                      width: `${totalWidth}px`,
                      order: position === 1 ? 2 : position === 2 ? 1 : 3
                    }}
                  >
                    <div className={`flex ${isMultiple ? 'gap-2' : ''} mb-4 justify-center`} style={{ width: `${totalWidth}px` }}>
                      {playersAtPosition.map((result) => (
                        <div key={result.player_id} className="flex flex-col items-center" style={{ width: '210px' }}>
                          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(position)} flex items-center justify-center text-3xl mb-3 shadow-lg`}>
                            {getMedalEmoji(position)}
                          </div>

                          <div className="bg-slate-800/70 rounded-lg p-4 w-full text-center">
                            <p className="font-bold text-white text-lg mb-2 truncate">{result.player_name}</p>
                            <p className="text-yellow-400 text-2xl font-bold">{result.vote_count} votes</p>
                            <p className="text-gray-400 text-sm">{result.percentage}%</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div 
                      className={`${getPodiumHeight(position)} bg-gradient-to-t ${getMedalColor(position)} rounded-t-xl flex items-center justify-center transition-all duration-500`}
                      style={{ width: `${totalWidth}px` }}
                    >
                      <span className="text-white font-bold text-4xl">{position}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-gray-400">Aucun vote enregistré</p>
          )}

          {topResults.filter(r => r.displayRank > 3).length > 0 && (
            <div className="mt-8 space-y-2">
              <h3 className="text-xl font-bold text-white mb-4 text-center">Reste du classement</h3>
              {topResults.filter(r => r.displayRank > 3).map((result) => (
                <div key={result.player_id} className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-400">#{result.displayRank}</span>
                    <span className="text-white font-semibold">{result.player_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">{result.vote_count} votes</p>
                    <p className="text-gray-400 text-sm">{result.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <ThumbsDown className="text-purple-400" size={32} />
            <h2 className="text-3xl font-bold text-white">Flop du match</h2>
          </div>

          {flopResults.length > 0 ? (
            <div className="flex items-end justify-center gap-8 mb-8">
              {[2, 1, 3].map(position => {
                const playersAtPosition = flopGrouped[position] || []
                if (playersAtPosition.length === 0) return null

                const isMultiple = playersAtPosition.length > 1
                const totalWidth = isMultiple ? playersAtPosition.length * 220 : 220

                return (
                  <div
                    key={position}
                    className="flex flex-col items-center"
                    style={{ 
                      width: `${totalWidth}px`,
                      order: position === 1 ? 2 : position === 2 ? 1 : 3
                    }}
                  >
                    <div className={`flex ${isMultiple ? 'gap-2' : ''} mb-4 justify-center`} style={{ width: `${totalWidth}px` }}>
                      {playersAtPosition.map((result) => (
                        <div key={result.player_id} className="flex flex-col items-center" style={{ width: '210px' }}>
                          <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(position)} flex items-center justify-center text-3xl mb-3 shadow-lg`}>
                            {getMedalEmoji(position)}
                          </div>

                          <div className="bg-slate-800/70 rounded-lg p-4 w-full text-center">
                            <p className="font-bold text-white text-lg mb-2 truncate">{result.player_name}</p>
                            <p className="text-purple-400 text-2xl font-bold">{result.vote_count} votes</p>
                            <p className="text-gray-400 text-sm">{result.percentage}%</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div 
                      className={`${getPodiumHeight(position)} bg-gradient-to-t ${getMedalColor(position)} rounded-t-xl flex items-center justify-center transition-all duration-500`}
                      style={{ width: `${totalWidth}px` }}
                    >
                      <span className="text-white font-bold text-4xl">{position}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-gray-400">Aucun vote enregistré</p>
          )}

          {flopResults.filter(r => r.displayRank > 3).length > 0 && (
            <div className="mt-8 space-y-2">
              <h3 className="text-xl font-bold text-white mb-4 text-center">Reste du classement</h3>
              {flopResults.filter(r => r.displayRank > 3).map((result) => (
                <div key={result.player_id} className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-gray-400">#{result.displayRank}</span>
                    <span className="text-white font-semibold">{result.player_name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-purple-400 font-bold">{result.vote_count} votes</p>
                    <p className="text-gray-400 text-sm">{result.percentage}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    </div>
  )
}