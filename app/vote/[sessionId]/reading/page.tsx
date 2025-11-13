'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Loader, ThumbsDown, Trophy, Sparkles, Flame, ChevronRight } from 'lucide-react'

// ... (gardez tous les types et la fonction shuffleArray identiques)

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
  const [teamId, setTeamId] = useState<string | null>(null) // ← CHANGEMENT ICI

  // ... (gardez loadReadingData identique jusqu'à la partie membership)

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

      // Récupérer le team_id depuis la saison
      const { data: seasonData } = await supabase
        .from('seasons')
        .select('team_id')
        .eq('id', matchData?.season_id)
        .single()

      if (seasonData?.team_id) {
        setTeamId(seasonData.team_id)
        console.log('✅ Team ID récupéré:', seasonData.team_id)
      } else {
        console.error('❌ Impossible de récupérer le team_id')
      }

      // Vérifier si l'utilisateur est manager
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .single()

      const isUserManager = membership?.role === 'manager' || membership?.role === 'creator'
      setIsManager(isUserManager)

      // Vérifier si l'utilisateur est lecteur
      const isUserReader = sessionData.flop_reader_id === user.id || sessionData.top_reader_id === user.id
      setIsReader(isUserReader)

      console.log('👤 User:', user.id)
      console.log('🎭 Manager:', isUserManager)
      console.log('📖 Lecteur:', isUserReader)

      // ... (gardez le reste du code identique)
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors du chargement')
    } finally {
      setLoading(false)
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

    if (!teamId) {
      alert('Impossible de sauvegarder : team_id introuvable')
      return
    }

    try {
      setSavingQuote(true)

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

  // ... (gardez tout le reste du code identique)
}