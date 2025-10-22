'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ThumbsUp, ThumbsDown, Send, Loader } from 'lucide-react'
import RichTextEditor from '@/components/RichTextEditor'

interface Player {
  id: string
  name: string
}

interface MatchInfo {
  id: string
  opponent: string
  match_date: string
  team_id: string
}

interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

interface TeamMember {
  user_id: string
  profiles: Profile
}

export default function VotePage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.sessionId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
  const [topPlayerId, setTopPlayerId] = useState('')
  const [flopPlayerId, setFlopPlayerId] = useState('')
  const [topComment, setTopComment] = useState('')
  const [flopComment, setFlopComment] = useState('')
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')

  useEffect(() => {
    loadVotingData()
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadVotingData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUserId(user.id)

      const { data: sessionData } = await supabase
        .from('voting_sessions')
        .select(`
          id,
          status,
          matches (
            id,
            opponent,
            match_date,
            team_id
          )
        `)
        .eq('id', sessionId)
        .single()

      if (!sessionData || sessionData.status !== 'open') {
        router.push('/dashboard')
        return
      }

      const match = Array.isArray(sessionData.matches) 
        ? sessionData.matches[0] 
        : sessionData.matches

      setMatchInfo(match as MatchInfo)

      const { data: teamMembers } = await supabase
        .from('team_members')
        .select(`
          user_id,
          profiles (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('team_id', match.team_id)
        .eq('status', 'accepted')

      const playersList: Player[] = (teamMembers as TeamMember[])?.map((member) => ({
        id: member.profiles.id,
        name: member.profiles.first_name && member.profiles.last_name
          ? `${member.profiles.first_name} ${member.profiles.last_name}`
          : member.profiles.email || 'Joueur inconnu'
      })) || []

      setPlayers(playersList)

      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId)
        .eq('voter_id', user.id)
        .single()

      if (existingVote) {
        setTopPlayerId(existingVote.top_player_id || '')
        setFlopPlayerId(existingVote.flop_player_id || '')
        setTopComment(existingVote.top_comment || '')
        setFlopComment(existingVote.flop_comment || '')
      }

      setLoading(false)
    } catch (error) {
      console.error('Erreur:', error)
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!topPlayerId || !flopPlayerId) {
      alert('Veuillez sélectionner un joueur pour le TOP et le FLOP')
      return
    }

    if (topPlayerId === flopPlayerId) {
      alert('Vous ne pouvez pas voter pour la même personne en TOP et FLOP')
      return
    }

    try {
      setSubmitting(true)

      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('session_id', sessionId)
        .eq('voter_id', currentUserId)
        .single()

      if (existingVote) {
        await supabase
          .from('votes')
          .update({
            top_player_id: topPlayerId,
            flop_player_id: flopPlayerId,
            top_comment: topComment,
            flop_comment: flopComment,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVote.id)
      } else {
        await supabase
          .from('votes')
          .insert({
            session_id: sessionId,
            voter_id: currentUserId,
            top_player_id: topPlayerId,
            flop_player_id: flopPlayerId,
            top_comment: topComment,
            flop_comment: flopComment
          })
      }

      alert('Vote enregistré avec succès !')
      router.push('/dashboard')
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de l\'enregistrement du vote')
    } finally {
      setSubmitting(false)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Votez maintenant !</h1>
          {matchInfo && (
            <p className="text-gray-400">
              {matchInfo.opponent} - {new Date(matchInfo.match_date).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Vote TOP */}
          <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border border-green-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <ThumbsUp className="text-green-400" size={32} />
              <h2 className="text-2xl font-bold text-white">TOP du match</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Sélectionnez un joueur</label>
                <select
                  value={topPlayerId}
                  onChange={(e) => setTopPlayerId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="">-- Choisir un joueur --</option>
                  {players.map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">
                  Commentaire (optionnel)
                </label>
                <RichTextEditor
                  value={topComment}
                  onChange={setTopComment}
                  placeholder="Expliquez votre choix... (Ctrl+B pour gras, Ctrl+I pour italique)"
                  minHeight="120px"
                />
              </div>
            </div>
          </div>

          {/* Vote FLOP */}
          <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <ThumbsDown className="text-purple-400" size={32} />
              <h2 className="text-2xl font-bold text-white">FLOP du match</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2 font-semibold">Sélectionnez un joueur</label>
                <select
                  value={flopPlayerId}
                  onChange={(e) => setFlopPlayerId(e.target.value)}
                  className="w-full bg-slate-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="">-- Choisir un joueur --</option>
                  {players.map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">
                  Commentaire (optionnel)
                </label>
                <RichTextEditor
                  value={flopComment}
                  onChange={setFlopComment}
                  placeholder="Expliquez votre choix... (Ctrl+B pour gras, Ctrl+I pour italique)"
                  minHeight="120px"
                />
              </div>
            </div>
          </div>

          {/* Bouton soumettre */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !topPlayerId || !flopPlayerId}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg"
          >
            {submitting ? (
              <>
                <Loader className="animate-spin" size={20} />
                <span>Envoi en cours...</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>Envoyer mon vote</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}