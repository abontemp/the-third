'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Quote, TrendingUp, TrendingDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type SavedQuote = {
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

export default function QuotesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState<SavedQuote[]>([])
  const [filter, setFilter] = useState<'all' | 'top' | 'flop'>('all')

  useEffect(() => {
    loadQuotes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadQuotes = async () => {
    try {
      console.log('🔍 Chargement des citations...')
      setLoading(true)
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('❌ Erreur auth:', userError)
        router.push('/login')
        return
      }

      console.log('✅ Utilisateur trouvé:', user.id)

      const { data: membership, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (membershipError || !membership) {
        console.error('⚠️ Erreur membership:', membershipError)
        setLoading(false)
        return
      }

      console.log('✅ Équipe trouvée:', membership.team_id)

      // Récupérer les citations sauvegardées
      const { data: quotesData, error: quotesError } = await supabase
        .from('saved_quotes')
        .select(`
          id,
          comment,
          vote_type,
          voter_id,
          player_id,
          saved_at,
          votes (
            voting_sessions (
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
        .eq('team_id', membership.team_id)
        .order('saved_at', { ascending: false })

      if (quotesError) {
        console.error('⚠️ Erreur quotes:', quotesError)
        setLoading(false)
        return
      }

      console.log('✅ Citations récupérées:', quotesData?.length || 0)

      if (!quotesData || quotesData.length === 0) {
        setQuotes([])
        setLoading(false)
        return
      }

      // Récupérer les profils pour les noms
      const userIds = new Set<string>()
      quotesData.forEach(q => {
        userIds.add(q.voter_id)
        userIds.add(q.player_id)
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

      // Formater les citations
      const formattedQuotes = quotesData
        .filter(q => {
          if (filter === 'all') return true
          return q.vote_type === filter
        })
        .map(q => {
          // Gérer la structure imbriquée avec any pour éviter les erreurs TypeScript
          const voteData: any = Array.isArray(q.votes) ? q.votes[0] : q.votes
          const sessionData: any = voteData?.voting_sessions
          const matchData: any = Array.isArray(sessionData?.matches) 
            ? sessionData.matches[0] 
            : sessionData?.matches
          const seasonData: any = Array.isArray(matchData?.seasons)
            ? matchData.seasons[0]
            : matchData?.seasons

          return {
            id: q.id,
            comment: q.comment,
            vote_type: q.vote_type as 'top' | 'flop',
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
      console.error('❌ Erreur générale:', err)
    } finally {
      setLoading(false)
      console.log('✅ Chargement terminé')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="text-white animate-spin mx-auto mb-4" size={48} />
          <p className="text-gray-400">Chargement des citations...</p>
        </div>
      </div>
    )
  }

  const filteredQuotes = quotes.filter(q => {
    if (filter === 'all') return true
    return q.vote_type === filter
  })

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
        {filteredQuotes.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Quote className="mx-auto mb-4 text-gray-600" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">
              {filter === 'all' ? 'Aucune citation pour le moment' : `Aucune citation ${filter.toUpperCase()}`}
            </h2>
            <p className="text-gray-400">
              Les managers peuvent sauvegarder des citations mémorables lors de la lecture des votes
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuotes.map((quote) => (
              <div 
                key={quote.id}
                className={`bg-gradient-to-br ${
                  quote.vote_type === 'top' 
                    ? 'from-green-900/30 to-emerald-900/30 border-green-500/30' 
                    : 'from-red-900/30 to-orange-900/30 border-red-500/30'
                } border rounded-2xl p-6`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-full ${
                    quote.vote_type === 'top' ? 'bg-green-500/20' : 'bg-red-500/20'
                  }`}>
                    {quote.vote_type === 'top' ? (
                      <TrendingUp className="text-green-400" size={24} />
                    ) : (
                      <TrendingDown className="text-red-400" size={24} />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <p className="text-lg text-white mb-3 italic">
                      &ldquo;{quote.comment}&rdquo;
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                      <span className="text-white font-semibold">{quote.voter_name}</span>
                      <span>→</span>
                      <span className="text-white font-semibold">{quote.player_name}</span>
                      <span>•</span>
                      <span>{quote.match_opponent}</span>
                      <span>•</span>
                      <span>{new Date(quote.match_date).toLocaleDateString('fr-FR')}</span>
                      {quote.season_name && (
                        <>
                          <span>•</span>
                          <span>{quote.season_name}</span>
                        </>
                      )}
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