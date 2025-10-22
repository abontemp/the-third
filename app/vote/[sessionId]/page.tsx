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

interface TeamMemberResponse {
  user_id: string
  profiles: Profile | Profile[] | null
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadVotingData = async () => {
    try {
      console.log('🔵 [VOTE PAGE] Début du chargement pour session:', sessionId)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('❌ [VOTE PAGE] Pas d\'utilisateur connecté')
        router.push('/login')
        return
      }
      console.log('✅ [VOTE PAGE] Utilisateur connecté:', user.id)
      setCurrentUserId(user.id)

      // CORRECTION : Charger la session sans la relation matches
      const { data: sessionData, error: sessionError } = await supabase
        .from('voting_sessions')
        .select('id, status, match_id')
        .eq('id', sessionId)
        .single()

      if (sessionError) {
        console.error('❌ [VOTE PAGE] Erreur session:', sessionError)
        alert('Session de vote introuvable')
        router.push('/dashboard')
        return
      }

      console.log('✅ [VOTE PAGE] Session trouvée:', sessionData)

      if (!sessionData) {
        console.log('❌ [VOTE PAGE] Session null')
        alert('Session de vote introuvable')
        router.push('/dashboard')
        return
      }

      if (sessionData.status !== 'open') {
        console.log('⚠️ [VOTE PAGE] Session non ouverte (status:', sessionData.status, ')')
        alert('Cette session de vote n\'est plus ouverte')
        router.push('/dashboard')
        return
      }

      // CORRECTION : Charger le match séparément
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, opponent, match_date, team_id')
        .eq('id', sessionData.match_id)
        .single()

      if (matchError || !matchData) {
        console.error('❌ [VOTE PAGE] Erreur match:', matchError)
        alert('Match introuvable')
        router.push('/dashboard')
        return
      }

      console.log('✅ [VOTE PAGE] Match:', matchData)

      setMatchInfo({
        id: matchData.id,
        opponent: matchData.opponent || '',
        match_date: matchData.match_date || '',
        team_id: matchData.team_id
      })

      const { data: teamMembers, error: membersError } = await supabase
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
        .eq('team_id', matchData.team_id)
        .eq('status', 'accepted')

      if (membersError) {
        console.error('❌ [VOTE PAGE] Erreur membres:', membersError)
      }

      console.log('✅ [VOTE PAGE] Membres récupérés:', teamMembers?.length || 0)

      const playersList: Player[] = (teamMembers as TeamMemberResponse[])?.map((member) => {
        const profile = member.profiles
          ? (Array.isArray(member.profiles) ? member.profiles[0] : member.profiles)
          : null

        if (!profile) {
          return {
            id: member.user_id,
            name: 'Joueur inconnu'
          }
        }

        return {
          id: profile.id,
          name: profile.first_name && profile.last_name
            ? `${profile.first_name} ${profile.last_name}`
            : profile.email || 'Joueur inconnu'
        }
      }) || []

      console.log('✅ [VOTE PAGE] Liste finale des joueurs:', playersList.length)
      setPlayers(playersList)

      const { data: existingVote } = await supabase
        .from('votes')
        .select('*')
        .eq('session_id', sessionId)
        .eq('voter_id', user.id)
        .maybeSingle()

      if (existingVote) {
        console.log('✅ [VOTE PAGE] Vote existant trouvé')
        setTopPlayerId(existingVote.top_player_id || '')
        setFlopPlayerId(existingVote.flop_player_id || '')
        setTopComment(existingVote.top_comment || '')
        setFlopComment(existingVote.flop_comment || '')
      } else {
        console.log('ℹ️ [VOTE PAGE] Pas de vote existant')
      }

      console.log('✅ [VOTE PAGE] Chargement terminé avec succès')
      setLoading(false)
    } catch (error) {
      console.error('❌ [VOTE PAGE] Erreur générale:', error)
      alert('Une erreur est survenue')
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
      console.log('🔵 [VOTE PAGE] Enregistrement du vote...')

      const { data: existingVote } = await supabase
        .from('votes')
        .select('id')
        .eq('session_id', sessionId)
        .eq('voter_id', currentUserId)
        .maybeSingle()

      if (existingVote) {
        console.log('🔵 [VOTE PAGE] Mise à jour du vote existant')
        const { error } = await supabase
          .from('votes')
          .update({
            top_player_id: topPlayerId,
            flop_player_id: flopPlayerId,
            top_comment: topComment,
            flop_comment: flopComment,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingVote.id)

        if (error) throw error
      } else {
        console.log('🔵 [VOTE PAGE] Création d\'un nouveau vote')
        const { error } = await supabase
          .from('votes')
          .insert({
            session_id: sessionId,
            voter_id: currentUserId,
            top_player_id: topPlayerId,
            flop_player_id: flopPlayerId,
            top_comment: topComment,
            flop_comment: flopComment
          })

        if (error) throw error
      }

      // Mettre à jour le statut has_voted dans session_participants
      await supabase
        .from('session_participants')
        .update({ has_voted: true })
        .eq('session_id', sessionId)
        .eq('user_id', currentUserId)

      console.log('✅ [VOTE PAGE] Vote enregistré')
      alert('Vote enregistré avec succès !')
      router.push('/dashboard')
    } catch (error) {
      console.error('❌ [VOTE PAGE] Erreur enregistrement:', error)
      alert('Erreur lors de l\'enregistrement du vote')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="text-white animate-spin mx-auto mb-4" size={48} />
          <p className="text-white">Chargement de la page de vote...</p>
          <p className="text-gray-400 text-sm mt-2">Session ID: {sessionId}</p>
        </div>
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

        {players.length === 0 ? (
          <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-300 font-semibold">Aucun joueur trouvé pour cette équipe</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition"
            >
              Retour au dashboard
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}