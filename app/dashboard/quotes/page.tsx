'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Quote, Trophy, ThumbsDown, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type QuoteType = {
  id: string
  comment: string
  vote_type: 'top' | 'flop'
  voter_name: string
  player_name: string
  match_opponent: string
  match_date: string
  saved_at: string
  season_name?: string
}

export default function MemorableQuotesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState<QuoteType[]>([])
  const [filter, setFilter] = useState<'all' | 'top' | 'flop'>('all')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  useEffect(() => {
    loadQuotes()
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuotes = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer l'équipe de l'utilisateur
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        router.push('/dashboard')
        return
      }

      setSelectedTeam(membership.team_id)

      // Récupérer toutes les citations de l'équipe
      const { data: quotesData } = await supabase
        .from('memorable_quotes')
        .select(`
          id,
          comment,
          vote_type,
          voter_id,
          player_id,
          saved_at,
          votes (
            session_id,
            voting_sessions (
              match_id,
              matches (
                opponent,
                match_date,
                seasons (
                  name
                )
              )
            )
          )
        `)
        .eq('votes.voting_sessions.matches.seasons.team_id', membership.team_id)
        .order('saved_at', { ascending: false })

      if (!quotesData) {
        setQuotes([])
        return
      }

      // Récupérer les profils des votants et joueurs
      const userIds = new Set<string>()
      quotesData.forEach(q => {
        if (q.voter_id) userIds.add(q.voter_id)
        if (q.player_id) userIds.add(q.player_id)
      })

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .in('id', Array.from(userIds))

      const profilesMap: Record<string, string> = {}
      profilesData?.forEach(p => {
        profilesMap[p.id] = p.nickname || 
                           (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8))
      })

      // Formater les citations
      const formattedQuotes = quotesData
        .filter(q => {
          if (filter === 'all') return true
          return q.vote_type === filter
        })
        .map(q => {
          const voteData = Array.isArray(q.votes) ? q.votes[0] : q.votes
          const sessionData = voteData?.voting_sessions as { matches?: unknown } | undefined
          const matchData = Array.isArray(sessionData?.matches) 
            ? (sessionData.matches as { opponent?: string; match_date?: string; seasons?: unknown }[])[0] 
            : (sessionData?.matches as { opponent?: string; match_date?: string; seasons?: unknown } | undefined)
          const seasonData = Array.isArray(matchData?.seasons)
            ? (matchData.seasons as { name?: string }[])[0]
            : (matchData?.seasons as { name?: string } | undefined)

          return {
            id: q.id,
            comment: q.comment,
            vote_type: q.vote_type,
            voter_name: profilesMap[q.voter_id] || 'Inconnu',
            player_name: profilesMap[q.player_id] || 'Inconnu',
            match_opponent: matchData?.opponent || 'Match inconnu',
            match_date: matchData?.match_date || '',
            saved_at: q.saved_at,
            season_name: seasonData?.name
          }
        })

      setQuotes(formattedQuotes)

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
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
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Quote size={24} />
              Mur des Citations
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Filtres */}
        <div className="flex justify-center gap-4 mb-8">
          <button
            onClick={() => setFilter('all')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            Toutes ({quotes.length})
          </button>
          <button
            onClick={() => setFilter('top')}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
              filter === 'top'
                ? 'bg-yellow-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            <Trophy size={18} />
            Citations TOP
          </button>
          <button
            onClick={() => setFilter('flop')}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
              filter === 'flop'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            <ThumbsDown size={18} />
            Citations FLOP
          </button>
        </div>

        {quotes.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Quote className="mx-auto mb-4 text-gray-600" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Aucune citation enregistrée</h2>
            <p className="text-gray-400">
              Les managers et lecteurs peuvent sauvegarder les meilleures citations pendant la lecture des votes
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quotes.map((quote) => (
              <div 
                key={quote.id}
                className={`bg-slate-800/50 backdrop-blur border rounded-2xl p-6 ${
                  quote.vote_type === 'top' 
                    ? 'border-yellow-500/30' 
                    : 'border-purple-500/30'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {quote.vote_type === 'top' ? (
                      <Trophy className="text-yellow-400" size={24} />
                    ) : (
                      <ThumbsDown className="text-purple-400" size={24} />
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      quote.vote_type === 'top'
                        ? 'bg-yellow-500/20 text-yellow-300'
                        : 'bg-purple-500/20 text-purple-300'
                    }`}>
                      {quote.vote_type === 'top' ? 'TOP' : 'FLOP'}
                    </span>
                  </div>
                  <Star className="text-yellow-400" size={20} />
                </div>

                <blockquote className="text-white text-lg mb-4 italic">
                  &ldquo;{quote.comment}&rdquo;
                </blockquote>

                <div className="text-sm text-gray-400 space-y-1">
                  <p>
                    <span className="text-gray-500">De</span>{' '}
                    <span className="text-white font-semibold">{quote.voter_name}</span>
                    {' '}<span className="text-gray-500">pour</span>{' '}
                    <span className="text-white font-semibold">{quote.player_name}</span>
                  </p>
                  <p>
                    <span className="text-gray-500">Match vs</span>{' '}
                    <span className="text-white">{quote.match_opponent}</span>
                  </p>
                  <p className="text-gray-500 text-xs">
                    {new Date(quote.match_date).toLocaleDateString('fr-FR')}
                    {quote.season_name && ` • ${quote.season_name}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}