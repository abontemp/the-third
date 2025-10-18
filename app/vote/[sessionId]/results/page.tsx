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

      // Charger les infos de la session
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

      // Charger tous les votes
      const { data: votes } = await supabase
        .from('votes')
        .select('top_player_id, flop_player_id')
        .eq('session_id', sessionId)

      if (!votes || votes.length === 0) {
        setLoading(false)
        return
      }

      // Compter les votes TOP
      const topCounts: Record<string, number> = {}
      votes.forEach(vote => {
        if (vote.top_player_id) {
          topCounts[vote.top_player_id] = (topCounts[vote.top_player_id] || 0) + 1
        }
      })

      // Compter les votes FLOP
      const flopCounts: Record<string, number> = {}
      votes.forEach(vote => {
        if (vote.flop_player_id) {
          flopCounts[vote.flop_player_id] = (flopCounts[vote.flop_player_id] || 0) + 1
        }
      })

      // Charger les noms des joueurs
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

      // Formater les résultats TOP
      const topResultsArray = Object.entries(topCounts)
        .map(([playerId, count]) => ({
          player_id: playerId,
          player_name: playerNames[playerId] || 'Joueur inconnu',
          vote_count: count,
          percentage: Math.round((count / votes.length) * 100)
        }))
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 3) // Top 3

      // Formater les résultats FLOP
      const flopResultsArray = Object.entries(flopCounts)
        .map(([playerId, count]) => ({
          player_id: playerId,
          player_name: playerNames[playerId] || 'Joueur inconnu',
          vote_count: count,
          percentage: Math.round((count / votes.length) * 100)
        }))
        .sort((a, b) => b.vote_count - a.vote_count)
        .slice(0, 3) // Top 3

      setTopResults(topResultsArray)
      setFlopResults(flopResultsArray)

    } catch (error) {
      console.error('Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPodiumHeight = (index: number) => {
    if (index === 0) return 'h-64' // 1er
    if (index === 1) return 'h-48' // 2ème
    return 'h-32' // 3ème
  }

  const getPodiumOrder = (index: number) => {
    // Ordre visuel : 2ème, 1er, 3ème
    if (index === 0) return 'order-2'
    if (index === 1) return 'order-1'
    return 'order-3'
  }

  const getMedalColor = (index: number) => {
    if (index === 0) return 'from-yellow-400 to-yellow-600' // Or
    if (index === 1) return 'from-gray-300 to-gray-500' // Argent
    return 'from-orange-400 to-orange-600' // Bronze
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
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

        {/* Podium TOP */}
        <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Trophy className="text-yellow-400" size={32} />
            <h2 className="text-3xl font-bold text-white">Top du match</h2>
          </div>

          {topResults.length > 0 ? (
            <div className="flex items-end justify-center gap-4 mb-8">
              {topResults.map((result, index) => (
                <div
                  key={result.player_id}
                  className={`flex flex-col items-center ${getPodiumOrder(index)}`}
                  style={{ width: '200px' }}
                >
                  {/* Médaille */}
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getMedalColor(index)} flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg`}>
                    {index + 1}
                  </div>

                  {/* Nom et stats */}
                  <div className="bg-slate-800/50 rounded-lg p-4 w-full text-center mb-4">
                    <p className="font-bold text-white text-lg mb-2">{result.player_name}</p>
                    <p className="text-yellow-400 text-2xl font-bold">{result.vote_count} votes</p>
                    <p className="text-gray-400 text-sm">{result.percentage}%</p>
                  </div>

                  {/* Colonne du podium */}
                  <div className={`w-full ${getPodiumHeight(index)} bg-gradient-to-t ${getMedalColor(index)} rounded-t-xl flex items-center justify-center transition-all duration-500`}>
                    <span className="text-white font-bold text-4xl">{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400">Aucun vote enregistré</p>
          )}
        </div>

        {/* Podium FLOP */}
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <ThumbsDown className="text-purple-400" size={32} />
            <h2 className="text-3xl font-bold text-white">Flop du match</h2>
          </div>

          {flopResults.length > 0 ? (
            <div className="flex items-end justify-center gap-4 mb-8">
              {flopResults.map((result, index) => (
                <div
                  key={result.player_id}
                  className={`flex flex-col items-center ${getPodiumOrder(index)}`}
                  style={{ width: '200px' }}
                >
                  {/* Médaille */}
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg">
                    {index + 1}
                  </div>

                  {/* Nom et stats */}
                  <div className="bg-slate-800/50 rounded-lg p-4 w-full text-center mb-4">
                    <p className="font-bold text-white text-lg mb-2">{result.player_name}</p>
                    <p className="text-purple-400 text-2xl font-bold">{result.vote_count} votes</p>
                    <p className="text-gray-400 text-sm">{result.percentage}%</p>
                  </div>

                  {/* Colonne du podium */}
                  <div className={`w-full ${getPodiumHeight(index)} bg-gradient-to-t from-purple-600 to-pink-600 rounded-t-xl flex items-center justify-center transition-all duration-500`}>
                    <span className="text-white font-bold text-4xl">{index + 1}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400">Aucun vote enregistré</p>
          )}
        </div>

        {/* Bouton retour */}
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