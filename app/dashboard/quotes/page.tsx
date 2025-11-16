'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Quote, TrendingUp, TrendingDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type QuoteType = {
  id: string
  comment: string
  vote_type: 'top' | 'flop'
  voter_name: string
  player_name: string
  player_avatar: string | null
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

  useEffect(() => {
    loadQuotes()
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuotes = async () => {
    try {
      setLoading(true)
      console.log('Chargement des citations...')
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      console.log('✅ Utilisateur trouvé:', user.id)

      // Récupérer team_id depuis URL ou localStorage
      let teamId: string | null = null
      
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        teamId = params.get('team_id')
        console.log('🔗 Team ID depuis URL:', teamId)
      }

      if (!teamId && typeof window !== 'undefined') {
        teamId = localStorage.getItem('selectedTeamId')
        console.log('📦 Team ID depuis localStorage:', teamId)
      }

      // Fallback: première équipe de l'utilisateur
      if (!teamId) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!membership) {
          router.push('/dashboard')
          return
        }
        teamId = membership.team_id
      }

      console.log('✅ Équipe trouvée:', teamId)

      // Récupérer toutes les saisons de cette équipe
      const { data: seasons } = await supabase
        .from('seasons')
        .select('id, name')
        .eq('team_id', teamId)

      const seasonIds = seasons?.map(s => s.id) || []
      const seasonNamesMap: Record<string, string> = {}
      seasons?.forEach(s => {
        seasonNamesMap[s.id] = s.name
      })

      if (seasonIds.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer tous les matchs de ces saisons
      const { data: matches } = await supabase
        .from('matches')
        .select('id, opponent, match_date, season_id')
        .in('season_id', seasonIds)

      const matchMap: Record<string, { opponent: string; date: string; season: string }> = {}
      matches?.forEach(m => {
        matchMap[m.id] = {
          opponent: m.opponent,
          date: m.match_date,
          season: seasonNamesMap[m.season_id] || ''
        }
      })

      const matchIds = matches?.map(m => m.id) || []

      if (matchIds.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer toutes les sessions de vote
      const { data: sessions } = await supabase
        .from('voting_sessions')
        .select('id, match_id')
        .in('match_id', matchIds)

      const sessionMatchMap: Record<string, string> = {}
      sessions?.forEach(s => {
        sessionMatchMap[s.id] = s.match_id
      })

      const sessionIds = sessions?.map(s => s.id) || []

      if (sessionIds.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer tous les vote IDs de ces sessions
      const { data: votesForSessions } = await supabase
        .from('votes')
        .select('id, session_id')
        .in('session_id', sessionIds)

      const voteIdsFromSessions = votesForSessions?.map(v => v.id) || []
      const voteSessionMap: Record<string, string> = {}
      votesForSessions?.forEach(v => {
        voteSessionMap[v.id] = v.session_id
      })

      if (voteIdsFromSessions.length === 0) {
        setLoading(false)
        return
      }

      // Récupérer toutes les citations
      const { data: quotesData } = await supabase
        .from('memorable_quotes')
        .select('id, comment, vote_type, voter_id, player_id, saved_at, vote_id')
        .in('vote_id', voteIdsFromSessions)
        .order('saved_at', { ascending: false })

      console.log('✅ Citations récupérées:', quotesData?.length || 0)

      if (!quotesData || quotesData.length === 0) {
        setQuotes([])
        setLoading(false)
        return
      }

      // Récupérer les profils des votants et joueurs (FILTRER LES NULL)
      const userIds = new Set<string>()
      quotesData.forEach(q => {
        if (q.voter_id) userIds.add(q.voter_id)
        if (q.player_id) userIds.add(q.player_id)
      })

      // Convertir en array et filtrer les valeurs null/undefined
      const validUserIds = Array.from(userIds).filter(id => id != null)

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, avatar_url')
        .in('id', validUserIds)

      const profilesMap: Record<string, { name: string; avatar: string | null }> = {}
      profilesData?.forEach(p => {
        profilesMap[p.id] = {
          name: p.nickname || 
                (p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.id.substring(0, 8)),
          avatar: p.avatar_url
        }
      })

      // Formater les citations
      const formattedQuotes = quotesData
        .filter(q => {
          if (filter === 'all') return true
          return q.vote_type === filter
        })
        .map(q => {
          const sessionId = voteSessionMap[q.vote_id]
          const matchId = sessionMatchMap[sessionId]
          const matchData = matchMap[matchId]

          return {
            id: q.id,
            comment: q.comment,
            vote_type: q.vote_type,
            voter_name: profilesMap[q.voter_id]?.name || 'Inconnu',
            player_name: profilesMap[q.player_id]?.name || 'Inconnu',
            player_avatar: profilesMap[q.player_id]?.avatar || null,
            match_opponent: matchData?.opponent || 'Match inconnu',
            match_date: matchData?.date || '',
            saved_at: q.saved_at,
            season_name: matchData?.season
          }
        })

      setQuotes(formattedQuotes)
      console.log('✅ Chargement terminé')

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
            <div className="w-32"></div>
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
                ? 'bg-green-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp size={20} />
            TOP ({quotes.filter(q => q.vote_type === 'top').length})
          </button>
          <button
            onClick={() => setFilter('flop')}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
              filter === 'flop'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800/50 text-gray-400 hover:text-white'
            }`}
          >
            <TrendingDown size={20} />
            FLOP ({quotes.filter(q => q.vote_type === 'flop').length})
          </button>
        </div>

        {/* Liste des citations */}
        {quotes.length === 0 ? (
          <div className="text-center py-16">
            <Quote className="mx-auto text-gray-600 mb-4" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Aucune citation mémorable</h2>
            <p className="text-gray-400">
              Les managers et lecteurs peuvent sauvegarder des commentaires marquants pendant la lecture des votes.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {quotes.map((quote) => (
              <div 
                key={quote.id} 
                className={`rounded-2xl p-6 border-2 ${
                  quote.vote_type === 'top'
                    ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30'
                    : 'bg-gradient-to-br from-red-900/30 to-orange-900/30 border-red-500/30'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar du joueur visé */}
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
                    quote.vote_type === 'top'
                      ? 'bg-gradient-to-br from-green-500 to-emerald-500'
                      : 'bg-gradient-to-br from-red-500 to-orange-500'
                  }`}>
                    {quote.player_avatar ? (
                      <img src={quote.player_avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-2xl">
                        {quote.player_name[0]?.toUpperCase() || '?'}
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    {/* Badge TYPE */}
                    <div className="flex items-center gap-2 mb-2">
                      {quote.vote_type === 'top' ? (
                        <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <TrendingUp size={14} />
                          TOP
                        </span>
                      ) : (
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                          <TrendingDown size={14} />
                          FLOP
                        </span>
                      )}
                      <span className="text-gray-400 text-sm">
                        {quote.vote_type === 'top' ? 'pour' : 'contre'}{' '}
                        <strong className="text-white">{quote.player_name}</strong>
                      </span>
                    </div>

                    {/* Citation */}
                    <blockquote className="text-white text-lg italic mb-4 pl-4 border-l-4 border-white/20">
                      &ldquo;{quote.comment}&rdquo;
                    </blockquote>

                    {/* Infos match */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                      <span>
                        📅 {new Date(quote.match_date).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                      <span>⚔️ vs {quote.match_opponent}</span>
                      {quote.season_name && <span>🏆 {quote.season_name}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}