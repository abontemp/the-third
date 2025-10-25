'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, Users, Loader, Trophy, TrendingUp, TrendingDown, Sparkles, Flame, CheckCircle } from 'lucide-react'

type TeamMember = {
  user_id: string
  display_name: string
  avatar_url?: string
  selected: boolean
}

export default function CreateMatchPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [teamId, setTeamId] = useState<string>('')
  const [opponent, setOpponent] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  
  // Aspects du vote
  const [includePredictions, setIncludePredictions] = useState(false)
  const [includeBestAction, setIncludeBestAction] = useState(false)
  const [includeWorstAction, setIncludeWorstAction] = useState(false)

  useEffect(() => {
    initializePage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const initializePage = async () => {
    try {
      // Essayer de récupérer teamId depuis l'URL
      let currentTeamId = params?.teamId as string

      // Si pas dans l'URL, essayer depuis localStorage
      if (!currentTeamId) {
        const storedTeamId = localStorage.getItem('selectedTeamId')
        if (storedTeamId) {
          currentTeamId = storedTeamId
        }
      }

      // Si toujours pas de teamId, vérifier l'utilisateur et sa première équipe
      if (!currentTeamId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .eq('status', 'accepted')
          .limit(1)
          .single()

        if (membership) {
          currentTeamId = membership.team_id
        }
      }

      if (!currentTeamId) {
        alert('Aucune équipe trouvée. Veuillez d\'abord rejoindre ou créer une équipe.')
        router.push('/dashboard')
        return
      }

      setTeamId(currentTeamId)
      await loadMembers(currentTeamId)

    } catch (err) {
      console.error('Erreur initialisation:', err)
      alert('Erreur lors de l\'initialisation')
      router.push('/dashboard')
    }
  }

  const loadMembers = async (currentTeamId: string) => {
    try {
      setLoading(true)

      // Récupérer tous les membres acceptés de l'équipe
      const { data: membersData } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', currentTeamId)
        .eq('status', 'accepted')

      if (!membersData || membersData.length === 0) {
        alert('Aucun membre trouvé dans cette équipe')
        router.push('/dashboard')
        return
      }

      // Récupérer les profils
      const userIds = membersData.map(m => m.user_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, email, avatar_url')
        .in('id', userIds)

      const formattedMembers = membersData.map(member => {
        const profile = profilesData?.find(p => p.id === member.user_id)
        
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
          user_id: member.user_id,
          display_name: displayName,
          avatar_url: profile?.avatar_url,
          selected: true // Tous sélectionnés par défaut
        }
      })

      setMembers(formattedMembers)

    } catch (err) {
      console.error('Erreur chargement membres:', err)
      alert('Erreur lors du chargement des membres')
    } finally {
      setLoading(false)
    }
  }

  const toggleMember = (userId: string) => {
    setMembers(members.map(m => 
      m.user_id === userId ? { ...m, selected: !m.selected } : m
    ))
  }

  const selectAll = () => {
    setMembers(members.map(m => ({ ...m, selected: true })))
  }

  const deselectAll = () => {
    setMembers(members.map(m => ({ ...m, selected: false })))
  }

  const handleCreateMatch = async () => {
    if (!opponent.trim()) {
      alert('Veuillez entrer le nom de l\'adversaire')
      return
    }

    if (!matchDate) {
      alert('Veuillez sélectionner une date de match')
      return
    }

    const selectedMembers = members.filter(m => m.selected)
    if (selectedMembers.length < 2) {
      alert('Sélectionnez au moins 2 participants pour le vote')
      return
    }

    try {
      setCreating(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer la saison active
      const { data: activeSeason } = await supabase
        .from('seasons')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_active', true)
        .single()

      if (!activeSeason) {
        alert('Aucune saison active trouvée. Créez une saison d\'abord.')
        return
      }

      // Créer le match
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert([{
          season_id: activeSeason.id,
          opponent: opponent.trim(),
          match_date: matchDate,
          status: 'scheduled',
          created_by: user.id
        }])
        .select()
        .single()

      if (matchError) {
        console.error('Erreur création match:', matchError)
        throw matchError
      }

      // Créer la session de vote avec les aspects sélectionnés
      const { data: sessionData, error: sessionError } = await supabase
        .from('voting_sessions')
        .insert([{
          match_id: matchData.id,
          status: 'open',
          include_predictions: includePredictions,
          include_best_action: includeBestAction,
          include_worst_action: includeWorstAction
        }])
        .select()
        .single()

      if (sessionError) throw sessionError

      // Ajouter les participants
      const participants = selectedMembers.map(member => ({
        session_id: sessionData.id,
        user_id: member.user_id,
        has_voted: false
      }))

      const { error: participantsError } = await supabase
        .from('session_participants')
        .insert(participants)

      if (participantsError) throw participantsError

      // Créer des notifications pour tous les participants (optionnel)
      try {
        const notifications = selectedMembers.map(member => ({
          user_id: member.user_id,
          type: 'vote_opened',
          title: 'Nouveau vote !',
          message: `Vote ouvert pour le match contre ${opponent.trim()}`,
          link: `/vote/${sessionData.id}`,
          is_read: false
        }))

        const { error: notifError } = await supabase
          .from('notifications')
          .insert(notifications)

        if (notifError) {
          console.log('Notifications non envoyées (table peut-être absente):', notifError)
        }
      } catch (notifErr) {
        console.log('Erreur notifications (non bloquant):', notifErr)
      }

      alert('Match créé et vote lancé avec succès !')
      router.push(`/vote/${sessionData.id}/manage`)

    } catch (err) {
      console.error('Erreur création match:', err)
      alert('Erreur lors de la création du match')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-blue-400" size={48} />
      </div>
    )
  }

  const selectedCount = members.filter(m => m.selected).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-blue-300 hover:text-blue-100 mb-6 flex items-center gap-2 transition"
        >
          <ArrowLeft size={20} />
          Retour au dashboard
        </button>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
            <Trophy className="text-yellow-400" size={32} />
            Créer un match et lancer les votes
          </h1>

          <div className="space-y-6">
            {/* Informations du match */}
            <div className="bg-slate-700/30 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-semibold text-white mb-4">Informations du match</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Adversaire
                  </label>
                  <input
                    type="text"
                    value={opponent}
                    onChange={(e) => setOpponent(e.target.value)}
                    placeholder="Nom de l'équipe adverse"
                    className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Date du match
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="date"
                      value={matchDate}
                      onChange={(e) => setMatchDate(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-700/50 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Aspects du vote */}
            <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg p-6 border border-purple-500/30">
              <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                <Sparkles className="text-purple-400" size={24} />
                Aspects du vote
              </h2>
              <p className="text-gray-400 text-sm mb-4">
                Les votes TOP et FLOP sont obligatoires. Cochez les aspects supplémentaires à inclure :
              </p>

              <div className="space-y-3">
                {/* TOP et FLOP (obligatoires) */}
                <div className="bg-slate-700/50 rounded-lg p-4 border border-green-500/30">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="text-green-400" size={20} />
                    <div className="flex-1">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <TrendingUp className="text-green-400" size={18} />
                        Vote TOP
                        <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">Obligatoire</span>
                      </h3>
                      <p className="text-gray-400 text-sm">Meilleur joueur du match</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-4 border border-red-500/30">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="text-red-400" size={20} />
                    <div className="flex-1">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <TrendingDown className="text-red-400" size={18} />
                        Vote FLOP
                        <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-300 text-xs rounded">Obligatoire</span>
                      </h3>
                      <p className="text-gray-400 text-sm">Moins bon joueur du match</p>
                    </div>
                  </div>
                </div>

                {/* Prédictions (optionnel) */}
                <button
                  onClick={() => setIncludePredictions(!includePredictions)}
                  className={`w-full rounded-lg p-4 border transition ${
                    includePredictions
                      ? 'bg-purple-500/20 border-purple-500/50'
                      : 'bg-slate-700/30 border-white/10 hover:border-purple-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      includePredictions ? 'bg-purple-600 border-purple-600' : 'border-gray-400'
                    }`}>
                      {includePredictions && <CheckCircle className="text-white" size={16} />}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <Trophy className="text-purple-400" size={18} />
                        Prédictions TOP/FLOP
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Les votants doivent prédire qui sera TOP/FLOP avant de voter
                      </p>
                    </div>
                  </div>
                </button>

                {/* Plus beau geste (optionnel) */}
                <button
                  onClick={() => setIncludeBestAction(!includeBestAction)}
                  className={`w-full rounded-lg p-4 border transition ${
                    includeBestAction
                      ? 'bg-blue-500/20 border-blue-500/50'
                      : 'bg-slate-700/30 border-white/10 hover:border-blue-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      includeBestAction ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
                    }`}>
                      {includeBestAction && <CheckCircle className="text-white" size={16} />}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <Sparkles className="text-blue-400" size={18} />
                        Plus beau geste
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Vote pour l&apos;action la plus impressionnante du match
                      </p>
                    </div>
                  </div>
                </button>

                {/* Plus beau fail (optionnel) */}
                <button
                  onClick={() => setIncludeWorstAction(!includeWorstAction)}
                  className={`w-full rounded-lg p-4 border transition ${
                    includeWorstAction
                      ? 'bg-orange-500/20 border-orange-500/50'
                      : 'bg-slate-700/30 border-white/10 hover:border-orange-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      includeWorstAction ? 'bg-orange-600 border-orange-600' : 'border-gray-400'
                    }`}>
                      {includeWorstAction && <CheckCircle className="text-white" size={16} />}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white font-semibold flex items-center gap-2">
                        <Flame className="text-orange-400" size={18} />
                        Plus beau fail
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Vote pour l&apos;action la plus ratée du match
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Sélection des participants */}
            <div className="bg-slate-700/30 rounded-lg p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">
                  Participants au vote ({selectedCount}/{members.length})
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => toggleMember(member.user_id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                      member.selected
                        ? 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-slate-700/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      member.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
                    }`}>
                      {member.selected && <Users className="text-white" size={14} />}
                    </div>
                    
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.display_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-sm">
                          {member.display_name[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <span className="text-white font-medium flex-1 text-left">
                      {member.display_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bouton de création */}
            <button
              onClick={handleCreateMatch}
              disabled={creating || selectedCount < 2 || !opponent.trim() || !matchDate}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Création en cours...
                </>
              ) : (
                <>
                  <Trophy size={20} />
                  Créer le match et lancer les votes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}