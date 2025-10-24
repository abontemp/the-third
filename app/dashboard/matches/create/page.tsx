'use client'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Loader, Users } from 'lucide-react'

type Member = {
  id: string
  user_id: string
  display_name: string
  role: string
}

export default function CreateMatchPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [teamId, setTeamId] = useState('')
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  
  const [opponent, setOpponent] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const [matchDate, setMatchDate] = useState(today)

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer l'équipe sélectionnée
      const savedTeamId = localStorage.getItem('selectedTeamId')
      if (!savedTeamId) {
        alert('Aucune équipe sélectionnée')
        router.push('/dashboard')
        return
      }

      setTeamId(savedTeamId)

      // Récupérer les infos de l'équipe
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', savedTeamId)
        .single()

      if (teamData) {
        setTeamName(teamData.name)
      }

      // Récupérer tous les membres de l'équipe
      const { data: membersData } = await supabase
        .from('team_members')
        .select('id, user_id, role, joined_at')
        .eq('team_id', savedTeamId)
        .order('joined_at', { ascending: true })

      if (!membersData) {
        console.log('Aucun membre trouvé')
        return
      }

      console.log('Membres trouvés:', membersData.length)

      // Récupérer les noms des membres
      const membersWithNames = await Promise.all(
        membersData.map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email, nickname')
            .eq('id', member.user_id)
            .single()

          let displayName = 'Utilisateur'
          
          if (profile) {
            if (profile.nickname?.trim()) {
              displayName = profile.nickname.trim()
            } else if (profile.first_name || profile.last_name) {
              const firstName = profile.first_name?.trim() || ''
              const lastName = profile.last_name?.trim() || ''
              displayName = `${firstName} ${lastName}`.trim()
            } else if (profile.email) {
              displayName = profile.email
            }
          }

          return {
            id: member.id,
            user_id: member.user_id,
            display_name: displayName,
            role: member.role
          }
        })
      )

      console.log('Membres avec noms:', membersWithNames)
      setMembers(membersWithNames)

    } catch (err) {
      console.error('Erreur chargement:', err)
      alert('Erreur lors du chargement des données')
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId)
      } else {
        return [...prev, memberId]
      }
    })
  }

  const selectAll = () => {
    setSelectedMembers(members.map(m => m.user_id))
  }

  const deselectAll = () => {
    setSelectedMembers([])
  }

  const handleSubmit = async () => {
    if (!opponent.trim()) {
      alert('Veuillez entrer le nom de l\'adversaire')
      return
    }

    if (selectedMembers.length < 2) {
      alert('Veuillez sélectionner au moins 2 participants')
      return
    }

    try {
      setSubmitting(true)

      // 1. Vérifier/créer la saison active
      let { data: season } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_current', true)
        .single()

      if (!season) {
        console.log('Création d\'une nouvelle saison...')
        const currentYear = new Date().getFullYear()
        const { data: newSeason, error: seasonError } = await supabase
          .from('seasons')
          .insert([{
            team_id: teamId,
            name: `Saison ${currentYear}`,
            start_date: `${currentYear}-01-01`,
            end_date: `${currentYear}-12-31`,
            is_current: true
          }])
          .select()
          .single()

        if (seasonError || !newSeason) {
          console.error('Erreur création saison:', seasonError)
          throw seasonError || new Error('Impossible de créer la saison')
        }
        season = newSeason
      }

      if (!season) {
        throw new Error('Aucune saison disponible')
      }

      console.log('Saison active:', season.id)

      // 2. Créer le match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert([{
          season_id: season.id,
          opponent: opponent.trim(),
          match_date: matchDate,
          status: 'scheduled'
        }])
        .select()
        .single()

      if (matchError) {
        console.error('Erreur création match:', matchError)
        throw matchError
      }

      console.log('Match créé:', match.id)

      // 3. Créer la session de vote
      const { data: votingSession, error: sessionError } = await supabase
        .from('voting_sessions')
        .insert([{
          match_id: match.id,
          status: 'open'
        }])
        .select()
        .single()

      if (sessionError) {
        console.error('Erreur création session:', sessionError)
        throw sessionError
      }

      console.log('Session de vote créée:', votingSession.id)

      // 4. Ajouter les participants
      const participants = selectedMembers.map(userId => ({
        session_id: votingSession.id,
        user_id: userId,
        has_voted: false
      }))

      const { error: participantsError } = await supabase
        .from('session_participants')
        .insert(participants)

      if (participantsError) {
        console.error('Erreur ajout participants:', participantsError)
        throw participantsError
      }

      console.log('Participants ajoutés:', participants.length)

      alert('Match et session de vote créés avec succès !')
      router.push('/dashboard')

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la création du match')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-purple-300 hover:text-purple-100 mb-6 flex items-center gap-2"
        >
          <ArrowLeft size={20} />
          Retour au dashboard
        </button>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Créer un match et lancer le vote</h1>
          <p className="text-gray-400 mb-8">Équipe : {teamName}</p>

          {/* Informations du match */}
          <div className="space-y-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar size={24} />
              Informations du match
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Adversaire *
              </label>
              <input
                type="text"
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Ex: Royal Leopold Club"
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Date du match *
              </label>
              <input
                type="date"
                value={matchDate}
                onChange={(e) => setMatchDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Sélection des participants */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users size={24} />
                Participants au vote ({selectedMembers.length}/{members.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded transition"
                >
                  Tous
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded transition"
                >
                  Aucun
                </button>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 text-orange-300">
                ⚠️ Aucun membre trouvé dans l&apos;équipe
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <button
                    key={member.user_id}
                    onClick={() => toggleMember(member.user_id)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition ${
                      selectedMembers.includes(member.user_id)
                        ? 'bg-purple-600/30 border-purple-500'
                        : 'bg-slate-700/30 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedMembers.includes(member.user_id)
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-400'
                      }`}>
                        {selectedMembers.includes(member.user_id) && (
                          <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        )}
                      </div>
                      <span className="text-white font-medium">{member.display_name}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      member.role === 'creator' ? 'bg-yellow-500/20 text-yellow-300' :
                      member.role === 'manager' ? 'bg-purple-500/20 text-purple-300' :
                      'bg-blue-500/20 text-blue-300'
                    }`}>
                      {member.role === 'creator' ? 'Créateur' :
                       member.role === 'manager' ? 'Manager' : 'Membre'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bouton de soumission */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !opponent.trim() || selectedMembers.length < 2}
            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader className="animate-spin" size={20} />
                <span>Création en cours...</span>
              </>
            ) : (
              <span>Créer le match et lancer le vote</span>
            )}
          </button>

          {selectedMembers.length < 2 && (
            <p className="text-orange-400 text-sm mt-2 text-center">
              Veuillez sélectionner au moins 2 participants
            </p>
          )}
        </div>
      </div>
    </div>
  )
}