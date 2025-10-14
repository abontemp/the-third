'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Trophy, ThumbsDown, Loader, Crown, Medal } from 'lucide-react'

type PlayerScore = {
  player_id: string
  player_name: string
  votes: number
}

type VotingSession = {
  match: {
    opponent: string
    match_date: string
  }
}

export default function ResultsPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<VotingSession | null>(null)
  const [topScores, setTopScores] = useState<PlayerScore[]>([])
  const [flopScores, setFlopScores] = useState<PlayerScore[]>([])

  useEffect(() => {
    loadResults()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadResults = async () => {
    try {
      const supabase = createClient()

      // Charger la session
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

      if (!sessionData) return

      const matchData = Array.isArray(sessionData.matches)
        ? sessionData.matches[0]
        : sessionData.matches

      setSession({
        match: {
          opponent: matchData?.opponent || '',
          match_date: matchData?.match_date || ''
        }
      })

      // Charger tous les votes
      const { data: votesData } = await supabase
        .from('votes')
        .select('top_player_id, flop_player_id')
        .eq('session_id', sessionId)

      if (!votesData || votesData.length === 0) return

      // Compter les votes TOP
      const topCounts: { [key: string]: number } = {}
      votesData.forEach(vote => {
        if (vote.top_player_id) {
          topCounts[vote.top_player_id] = (topCounts[vote.top_player_id] || 0) + 1
        }
      })

      // Compter les votes FLOP
      const flopCounts: { [key: string]: number } = {}
      votesData.forEach(vote => {
        if (vote.flop_player_id) {
          flopCounts[vote.flop_player_id] = (flopCounts[vote.flop_player_id] || 0) + 1
        }
      })

      // Récupérer les noms des joueurs
      const allPlayerIds = [
        ...new Set([
          ...Object.keys(topCounts),
          ...Object.keys(flopCounts)
        ])
      ]

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .in('id', allPlayerIds)

      const getPlayerName = (playerId: string) => {
        const profile = profilesData?.find(p => p.id === playerId)
        if (profile?.first_name && profile?.last_name) {
          return `${profile.first_name} ${profile.last_name}`
        }
        return profile?.email || 'Joueur inconnu'
      }

      // Transformer en tableau et trier
      const topScoresArray: PlayerScore[] = Object.entries(topCounts)
        .map(([player_id, votes]) => ({
          player_id,
          player_name: getPlayerName(player_id),
          votes
        }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3) // Top 3

      const flopScoresArray: PlayerScore[] = Object.entries(flopCounts)
        .map(([player_id, votes]) => ({
          player_id,
          player_name: getPlayerName(player_id),
          votes
        }))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3) // Top 3

      setTopScores(topScoresArray)
      setFlopScores(flopScoresArray)

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const getPodiumHeight = (index: number) => {
    if (index === 0) return 'h-48' // 1er
    if (index === 1) return 'h-40' // 2ème
    return 'h-32' // 3ème
  }

  const getPodiumIcon = (index: number) => {
    if (index === 0) return <Crown className="text-yellow-400" size={32} />
    if (index === 1) return <Medal className="text-gray-400" size={28} />
    return <Medal className="text-orange-600" size={24} />
  }

  const getPodiumColor = (index: number) => {
    if (index === 0) return 'from-yellow-600 to-yellow-800'
    if (index === 1) return 'from-gray-400 to-gray-600'
    return 'from-orange-600 to-orange-800'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

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

            <div className="text-right">
              <h2 className="text-white font-semibold">{session?.match.opponent}</h2>
              <p className="text-gray-400 text-sm">
                {session?.match.match_date && new Date(session.match.match_date).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">🎉 Résultats des votes 🎉</h1>
          <p className="text-xl text-gray-300">Découvrez le podium de ce match</p>
        </div>

        {/* Podium TOP */}
        <div className="mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Trophy className="text-blue-400" size={40} />
            <h2 className="text-3xl font-bold text-white">Podium TOP</h2>
          </div>

          {topScores.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-8 text-center">
              <p className="text-gray-400">Aucun vote TOP enregistré</p>
            </div>
          ) : (
            <div className="flex items-end justify-center gap-4 max-w-4xl mx-auto">
              {/* 2ème place */}
              {topScores[1] && (
                <div className="flex-1 max-w-xs">
                  <div className="text-center mb-4">
                    {getPodiumIcon(1)}
                    <p className="text-white font-bold text-xl mt-2">{topScores[1].player_name}</p>
                    <p className="text-gray-400 text-sm">{topScores[1].votes} vote{topScores[1].votes > 1 ? 's' : ''}</p>
                  </div>
                  <div className={`bg-gradient-to-b ${getPodiumColor(1)} rounded-t-xl ${getPodiumHeight(1)} flex items-center justify-center`}>
                    <span className="text-white text-6xl font-bold">2</span>
                  </div>
                </div>
              )}

              {/* 1ère place */}
              {topScores[0] && (
                <div className="flex-1 max-w-xs">
                  <div className="text-center mb-4">
                    {getPodiumIcon(0)}
                    <p className="text-white font-bold text-2xl mt-2">{topScores[0].player_name}</p>
                    <p className="text-gray-400">{topScores[0].votes} vote{topScores[0].votes > 1 ? 's' : ''}</p>
                  </div>
                  <div className={`bg-gradient-to-b ${getPodiumColor(0)} rounded-t-xl ${getPodiumHeight(0)} flex items-center justify-center animate-pulse`}>
                    <span className="text-white text-7xl font-bold">1</span>
                  </div>
                </div>
              )}

              {/* 3ème place */}
              {topScores[2] && (
                <div className="flex-1 max-w-xs">
                  <div className="text-center mb-4">
                    {getPodiumIcon(2)}
                    <p className="text-white font-bold text-lg mt-2">{topScores[2].player_name}</p>
                    <p className="text-gray-400 text-sm">{topScores[2].votes} vote{topScores[2].votes > 1 ? 's' : ''}</p>
                  </div>
                  <div className={`bg-gradient-to-b ${getPodiumColor(2)} rounded-t-xl ${getPodiumHeight(2)} flex items-center justify-center`}>
                    <span className="text-white text-5xl font-bold">3</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Podium FLOP */}
        <div>
          <div className="flex items-center justify-center gap-3 mb-8">
            <ThumbsDown className="text-orange-400" size={40} />
            <h2 className="text-3xl font-bold text-white">Podium FLOP</h2>
          </div>

          {flopScores.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-8 text-center">
              <p className="text-gray-400">Aucun vote FLOP enregistré</p>
            </div>
          ) : (
            <div className="flex items-end justify-center gap-4 max-w-4xl mx-auto">
              {/* 2ème place */}
              {flopScores[1] && (
                <div className="flex-1 max-w-xs">
                  <div className="text-center mb-4">
                    {getPodiumIcon(1)}
                    <p className="text-white font-bold text-xl mt-2">{flopScores[1].player_name}</p>
                    <p className="text-gray-400 text-sm">{flopScores[1].votes} vote{flopScores[1].votes > 1 ? 's' : ''}</p>
                  </div>
                  <div className={`bg-gradient-to-b ${getPodiumColor(1)} rounded-t-xl ${getPodiumHeight(1)} flex items-center justify-center`}>
                    <span className="text-white text-6xl font-bold">2</span>
                  </div>
                </div>
              )}

              {/* 1ère place */}
              {flopScores[0] && (
                <div className="flex-1 max-w-xs">
                  <div className="text-center mb-4">
                    {getPodiumIcon(0)}
                    <p className="text-white font-bold text-2xl mt-2">{flopScores[0].player_name}</p>
                    <p className="text-gray-400">{flopScores[0].votes} vote{flopScores[0].votes > 1 ? 's' : ''}</p>
                  </div>
                  <div className={`bg-gradient-to-b ${getPodiumColor(0)} rounded-t-xl ${getPodiumHeight(0)} flex items-center justify-center`}>
                    <span className="text-white text-7xl font-bold">1</span>
                  </div>
                </div>
              )}

              {/* 3ème place */}
              {flopScores[2] && (
                <div className="flex-1 max-w-xs">
                  <div className="text-center mb-4">
                    {getPodiumIcon(2)}
                    <p className="text-white font-bold text-lg mt-2">{flopScores[2].player_name}</p>
                    <p className="text-gray-400 text-sm">{flopScores[2].votes} vote{flopScores[2].votes > 1 ? 's' : ''}</p>
                  </div>
                  <div className={`bg-gradient-to-b ${getPodiumColor(2)} rounded-t-xl ${getPodiumHeight(2)} flex items-center justify-center`}>
                    <span className="text-white text-5xl font-bold">3</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bouton retour */}
        <div className="mt-16 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-4 rounded-lg font-semibold hover:shadow-lg transition"
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    </div>
  )
}