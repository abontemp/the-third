'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Users, Send, AlertCircle, CheckCircle, Loader } from 'lucide-react'

type TeamMember = {
  id: string
  user_id: string
  role: string
  display_name: string
  avatar_url?: string
}

type Match = {
  id: string
  opponent: string
  match_date: string
}

export default function CreateVotePage() {
  const router = useRouter()
  const params = useParams()
  const matchId = params.matchId as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [match, setMatch] = useState<Match | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])

  useEffect(() => {
    loadData()
  }, [matchId])

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      console.log('🔍 Chargement du match:', matchId)

      // Charger le match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, opponent, match_date, season_id')
        .eq('id', matchId)
        .single()

      console.log('📋 Match data:', matchData)

      if (matchError || !matchData) {
        setError("Match introuvable")
        console.error('Erreur match:', matchError)
        setLoading(false)
        return
      }

      setMatch({
        id: matchData.id,
        opponent: matchData.opponent,
        match_date: matchData.match_date
      })

      // Charger la saison pour obtenir le team_id
      const { data: seasonData, error: seasonError } = await supabase
        .from('seasons')
        .select('team_id')
        .eq('id', matchData.season_id)
        .single()

      console.log('🏀 Season data:', seasonData)

      if (seasonError || !seasonData) {
        setError("Impossible de trouver l'équipe")
        console.error('Erreur saison:', seasonError)
        setLoading(false)
        return
      }

      const teamId = seasonData.team_id

      console.log('🏀 Team ID:', teamId)

      // Vérifier que l'utilisateur est manager
      const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      console.log('👤 User role:', memberData?.role)

      if (!memberData || (memberData.role !== 'creator' && memberData.role !== 'manager')) {
        setError("Vous devez être manager pour créer un vote")
        setLoading(false)
        return
      }

      // 🎯 CORRECTION : Charger TOUS les membres de l'équipe
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('id, user_id, role')
        .eq('team_id', teamId)

      console.log('👥 Members data:', membersData)
      console.log('👥 Nombre de membres:', membersData?.length)

      if (membersError) {
        console.error('Erreur membres:', membersError)
        setError("Erreur lors du chargement des membres")
        setLoading(false)
        return
      }

      if (!membersData || membersData.length === 0) {
        setError("Aucun membre dans l'équipe")
        setLoading(false)
        return
      }

      // Charger les profils de TOUS les membres
      const userIds = membersData.map(m => m.user_id)
      
      console.log('🔍 Chargement des profils pour:', userIds)

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, avatar_url')
        .in('id', userIds)

      console.log('📝 Profiles data:', profilesData)
      console.log('📝 Nombre de profils:', profilesData?.length)

      // Créer un mapping des profiles
      const profilesMap: Record<string, { 
        display_name: string
        avatar_url?: string 
      }> = {}
      
      profilesData?.forEach(profile => {
        profilesMap[profile.id] = {
          display_name: profile.nickname || 
                       (profile.first_name && profile.last_name 
                         ? `${profile.first_name} ${profile.last_name}` 
                         : profile.id.substring(0, 8)),
          avatar_url: profile.avatar_url
        }
      })

      // Combiner les données
      const formattedMembers: TeamMember[] = membersData.map(member => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        display_name: profilesMap[member.user_id]?.display_name || `Membre #${member.user_id.substring(0, 8)}`,
        avatar_url: profilesMap[member.user_id]?.avatar_url
      }))

      console.log('✅ Membres formatés:', formattedMembers)
      setMembers(formattedMembers)

      // Sélectionner tous les membres par défaut
      setSelectedMembers(formattedMembers.map(m => m.id))

    } catch (err) {
      console.error('❌ Erreur globale:', err)
      setError("Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  const selectAll = () => {
    setSelectedMembers(members.map(m => m.id))
  }

  const deselectAll = () => {
    setSelectedMembers([])
  }

  const handleSubmit = async () => {
    if (selectedMembers.length < 2) {
      setError("Sélectionnez au moins 2 participants")
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const supabase = createClient()

      // Créer la session de vote
      const { data: session, error: sessionError } = await supabase
        .from('voting_sessions')
        .insert([{
          match_id: matchId,
          status: 'open'
        }])
        .select()
        .single()

      if (sessionError) throw sessionError

      // Ajouter les participants
      const participants = selectedMembers.map(memberId => {
        const member = members.find(m => m.id === memberId)
        return {
          session_id: session.id,
          user_id: member?.user_id,
          has_voted: false
        }
      })

      const { error: participantsError } = await supabase
        .from('session_participants')
        .insert(participants)

      if (participantsError) throw participantsError

      setSuccess("Vote créé avec succès ! Redirection...")
      
      setTimeout(() => {
        router.push(`/vote/${session.id}/manage`)
      }, 1500)

    } catch (err: unknown) {
      console.error('Erreur:', err)
      setError(err instanceof Error ? err.message : "Erreur lors de la création")
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Retour au dashboard</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">Qui participera au vote ?</h1>
          <p className="text-gray-400 mb-2">Sélectionnez les joueurs présents au match</p>
          {match && (
            <p className="text-blue-400 mb-8">
              Match : <span className="font-semibold">{match.opponent}</span> - {new Date(match.match_date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          )}

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-400" size={20} />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="text-green-400" size={20} />
              <p className="text-green-300 text-sm">{success}</p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {selectedMembers.length} participant{selectedMembers.length > 1 ? 's' : ''} sélectionné{selectedMembers.length > 1 ? 's' : ''}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={deselectAll}
                    className="text-sm text-gray-400 hover:text-gray-300 transition"
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {members.map(member => (
                  <div
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`
                      cursor-pointer p-4 rounded-lg border-2 transition-all
                      ${selectedMembers.includes(member.id)
                        ? 'bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/50'
                        : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'
                      }
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {member.display_name[0].toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{member.display_name}</p>
                        <p className="text-sm text-gray-400">
                          {member.role === 'creator' ? 'Créateur' :
                           member.role === 'manager' ? 'Manager' :
                           'Membre'}
                        </p>
                      </div>
                      <div className={`
                        w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                        ${selectedMembers.includes(member.id)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-500'
                        }
                      `}>
                        {selectedMembers.includes(member.id) && (
                          <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || selectedMembers.length < 2}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3"
            >
              {submitting ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Création en cours...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Créer le vote
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}