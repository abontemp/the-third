'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Send, AlertCircle, CheckCircle, Loader } from 'lucide-react'

type TeamMember = {
  id: string
  user_id: string
  role: string
  first_name?: string
  last_name?: string
  email?: string
}

type Match = {
  id: string
  opponent: string
  match_date: string
  location?: string
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
  }, [matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Charger le match
      const { data: matchData } = await supabase
        .from('matches')
        .select('*, seasons(team_id)')
        .eq('id', matchId)
        .single()

      if (!matchData) {
        setError("Match introuvable")
        return
      }

      setMatch({
        id: matchData.id,
        opponent: matchData.opponent,
        match_date: matchData.match_date,
        location: matchData.location
      })

      // Vérifier que l'utilisateur est manager
      const teamId = (matchData.seasons as { team_id: string }).team_id

      const { data: memberData } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (!memberData || (memberData.role !== 'creator' && memberData.role !== 'manager')) {
        setError("Vous devez être manager pour créer un vote")
        return
      }

      // Charger tous les membres de l'équipe
const { data: membersData } = await supabase
  .from('team_members')
  .select(`
    id, 
    user_id, 
    role,
    profiles (
      first_name,
      last_name,
      email
    )
  `)
  .eq('team_id', teamId)

// Transformer les données
const formattedMembers = membersData?.map(member => ({
  id: member.id,
  user_id: member.user_id,
  role: member.role,
  first_name: (member.profiles as { first_name?: string })?.first_name,
  last_name: (member.profiles as { last_name?: string })?.last_name,
  email: (member.profiles as { email?: string })?.email
})) || []

console.log('Membres chargés:', formattedMembers)
setMembers(formattedMembers)

    } catch (err) {
      console.error('Erreur:', err)
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
        <h1 className="text-3xl font-bold text-white mb-2">Créer un vote</h1>
        <p className="text-gray-400 mb-2">Étape 2/2 : Sélection des participants</p>
        {match && (
          <p className="text-blue-400 mb-8">
            Match : {match.opponent} - {new Date(match.match_date).toLocaleDateString('fr-FR')}
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
                Participants au vote ({selectedMembers.length}/{members.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-blue-400 hover:text-blue-300 transition"
                >
                  Tout sélectionner
                </button>
                <span className="text-gray-500">|</span>
                <button
                  onClick={deselectAll}
                  className="text-sm text-gray-400 hover:text-gray-300 transition"
                >
                  Tout désélectionner
                </button>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
                <p className="text-orange-300">Aucun membre disponible dans cette équipe</p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => toggleMember(member.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border-2 transition ${
                      selectedMembers.includes(member.id)
                        ? 'bg-blue-500/20 border-blue-500'
                        : 'bg-slate-700/30 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedMembers.includes(member.id)
                        ? 'bg-blue-500 border-blue-500'
                        : 'border-gray-400'
                    }`}>
                      {selectedMembers.includes(member.id) && (
                        <CheckCircle className="text-white" size={16} />
                      )}
                    </div>

                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                      {member.first_name 
                        ? member.first_name[0].toUpperCase() 
                        : member.user_id.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 text-left">
                      <p className="text-white font-medium">
                        {member.first_name && member.last_name
                          ? `${member.first_name} ${member.last_name}`
                          : member.email || `Membre #${member.user_id.substring(0, 8)}`}
                      </p>
                      <p className="text-sm text-gray-400">
                        {member.role === 'creator' ? 'Créateur' :
                         member.role === 'manager' ? 'Manager' : 'Membre'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || selectedMembers.length < 2}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader className="animate-spin" size={20} />
                <span>Création en cours...</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>Créer le vote</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </div>
)
}