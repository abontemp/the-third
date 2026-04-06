'use client'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/client'
import { getDisplayName } from '@/lib/utils/displayName'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Users, Plus, LogIn, Loader, Search, Hash, CheckCircle, ArrowLeft, Clock, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

type Team = {
  id: string
  name: string
  sport: string
  team_code: string
  description?: string
  member_count: number
}

type PendingRequest = {
  id: string
  team_id: string
  team_name: string
  team_sport: string
  created_at: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'loading' | 'choice' | 'create' | 'join' | 'pending'>('loading')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [searching, setSearching] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])

  // Pour créer une équipe
  const [teamName, setTeamName] = useState('')
  const [sport, setSport] = useState('')
  const [description, setDescription] = useState('')

  // Pour rejoindre une équipe
  const [searchMode, setSearchMode] = useState<'code' | 'name'>('code')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Team[]>([])
  const [searched, setSearched] = useState(false)

  const sports = [
    'Football', 'Basketball', 'Volleyball', 'Handball', 'Rugby',
    'Hockey', 'Tennis', 'Badminton', 'Baseball', 'Softball', 'Autre'
  ]

  useEffect(() => {
    checkInitialState()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkInitialState = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Vérifier si déjà dans une équipe → dashboard
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1)

      if (memberships && memberships.length > 0) {
        router.push('/dashboard')
        return
      }

      // Vérifier s'il a des demandes en attente
      const requests = await fetchPendingRequests(user.id)
      if (requests.length > 0) {
        setPendingRequests(requests)
        setStep('pending')
      } else {
        setStep('choice')
      }
    } catch (err) {
      logger.error('Erreur init:', err)
      setStep('choice')
    }
  }

  const fetchPendingRequests = async (userId: string): Promise<PendingRequest[]> => {
    const { data } = await supabase
      .from('join_requests')
      .select('id, team_id, created_at, teams(name, sport)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!data) return []

    return data.map((r) => {
      const team = Array.isArray(r.teams) ? r.teams[0] : r.teams
      return {
        id: r.id,
        team_id: r.team_id,
        team_name: (team as { name: string; sport: string })?.name || 'Équipe inconnue',
        team_sport: (team as { name: string; sport: string })?.sport || '',
        created_at: r.created_at,
      }
    })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Vérifier si une demande a été acceptée
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .limit(1)

      if (memberships && memberships.length > 0) {
        toast.success('Ta demande a été acceptée ! Bienvenue dans l\'équipe 🎉')
        router.push('/dashboard')
        return
      }

      // Rafraîchir la liste des demandes
      const requests = await fetchPendingRequests(user.id)
      setPendingRequests(requests)

      if (requests.length === 0) {
        setStep('choice')
      } else {
        toast.success('Liste mise à jour')
      }
    } catch (err) {
      logger.error('Erreur refresh:', err)
    } finally {
      setRefreshing(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !sport) {
      toast.warning('Veuillez remplir tous les champs obligatoires')
      return
    }

    try {
      setCreating(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([{ name: teamName.trim(), sport, description: description.trim() || null }])
        .select()
        .single()

      if (teamError) throw teamError

      const currentYear = new Date().getFullYear()
      const { error: seasonError } = await supabase
        .from('seasons')
        .insert([{
          team_id: team.id,
          name: `Saison ${currentYear}`,
          start_date: new Date().toISOString().split('T')[0],
          is_active: true
        }])

      if (seasonError) throw seasonError

      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{ team_id: team.id, user_id: user.id, role: 'creator' }])

      if (memberError) throw memberError

      toast.success(`Équipe "${teamName}" créée avec succès !`)
      router.push('/dashboard')

    } catch (err) {
      logger.error('Erreur:', err)
      toast.error('Erreur lors de la création de l\'équipe')
    } finally {
      setCreating(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.warning('Veuillez entrer un code ou un nom d\'équipe')
      return
    }

    try {
      setSearching(true)
      setSearched(true)

      const query = searchQuery.trim()
      if (query.length > 50) {
        toast.warning('La recherche ne peut pas dépasser 50 caractères')
        return
      }

      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('id, name, sport, team_code, description')
        .or(`team_code.eq.${query},name.ilike.%${query}%`)

      if (error) throw error
      if (!teamsData || teamsData.length === 0) { setSearchResults([]); return }

      const teamIds = teamsData.map(t => t.id)
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)

      const memberCountMap: Record<string, number> = {}
      memberRows?.forEach(r => {
        memberCountMap[r.team_id] = (memberCountMap[r.team_id] || 0) + 1
      })

      setSearchResults(teamsData.map(team => ({
        ...team,
        member_count: memberCountMap[team.id] || 0
      })))

    } catch (err) {
      logger.error('Erreur:', err)
      toast.error('Erreur lors de la recherche')
    } finally {
      setSearching(false)
    }
  }

  const handleRequestJoin = async (teamId: string, teamName: string) => {
    try {
      setJoining(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: existingMember } = await supabase
        .from('team_members').select('id')
        .eq('team_id', teamId).eq('user_id', user.id).single()

      if (existingMember) {
        toast.warning('Vous êtes déjà membre de cette équipe')
        router.push('/dashboard')
        return
      }

      const { data: existingRequest } = await supabase
        .from('join_requests').select('id, status')
        .eq('team_id', teamId).eq('user_id', user.id).single()

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          toast.warning('Vous avez déjà une demande en attente pour cette équipe')
        } else if (existingRequest.status === 'rejected') {
          toast.error('Votre demande précédente a été refusée')
        }
        return
      }

      const { error } = await supabase
        .from('join_requests')
        .insert([{ team_id: teamId, user_id: user.id, status: 'pending' }])

      if (error) throw error

      // Email managers
      const { data: profile } = await supabase
        .from('profiles').select('first_name, last_name, nickname, email')
        .eq('id', user.id).single()

      fetch('/api/notify-join-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, requester_name: getDisplayName(profile) }),
      }).catch(logger.error)

      // Aller sur l'écran pending
      const requests = await fetchPendingRequests(user.id)
      setPendingRequests(requests)
      setStep('pending')

    } catch (err) {
      logger.error('Erreur:', err)
      toast.error('Erreur lors de l\'envoi de la demande')
    } finally {
      setJoining(false)
    }
  }

  const resetJoinForm = () => {
    setSearched(false)
    setSearchResults([])
    setSearchQuery('')
  }

  // ─── LOADING ────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="The Third" className="w-14 h-14 mx-auto mb-3" />
          <span className="text-white/60 text-sm font-medium">The Third</span>
        </div>

        {/* ─── ÉCRAN EN ATTENTE ─── */}
        {step === 'pending' && (
          <div className="space-y-4">
            <div className="bg-slate-800/60 backdrop-blur border border-white/10 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-amber-400" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Demande en attente</h1>
              <p className="text-gray-400 text-sm">
                Un manager doit accepter ta demande. Tu recevras une notification dès que c'est fait.
              </p>
            </div>

            {/* Liste des demandes en attente */}
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="bg-slate-800/60 border border-amber-500/20 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0">
                    <Users className="text-amber-400" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{req.team_name}</p>
                    <p className="text-gray-400 text-xs">{req.team_sport} · Demande envoyée le {new Date(req.created_at).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 shrink-0">
                    <Clock size={12} />
                    En attente
                  </span>
                </div>
              ))}
            </div>

            {/* Bouton rafraîchir */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-white/10 text-gray-300 hover:text-white py-3 rounded-xl font-medium transition disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Vérification...' : 'Vérifier si accepté'}
            </button>

            {/* Séparateur */}
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-gray-500 text-sm">En attendant</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Actions secondaires */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => { resetJoinForm(); setStep('join') }}
                className="flex items-center justify-center gap-2 bg-slate-700/50 hover:bg-slate-700 border border-white/10 text-white py-3 px-4 rounded-xl font-medium transition"
              >
                <Search size={18} />
                Rejoindre une autre équipe
              </button>
              <button
                onClick={() => setStep('create')}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 px-4 rounded-xl font-medium transition"
              >
                <Plus size={18} />
                Créer ma propre équipe
              </button>
            </div>
          </div>
        )}

        {/* ─── ÉCRAN DE CHOIX ─── */}
        {step === 'choice' && (
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Bienvenue ! 👋</h1>
              <p className="text-gray-400">Commencez par créer ou rejoindre une équipe</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setStep('create')}
                className="bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-7 rounded-2xl transition shadow-xl text-left group"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <Plus size={28} />
                </div>
                <h2 className="text-xl font-bold mb-1">Créer une équipe</h2>
                <p className="text-blue-100 text-sm">Je suis manager, je crée mon équipe et j'invite mes joueurs</p>
              </button>

              <button
                onClick={() => setStep('join')}
                className="bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-7 rounded-2xl transition shadow-xl text-left group"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <LogIn size={28} />
                </div>
                <h2 className="text-xl font-bold mb-1">Rejoindre une équipe</h2>
                <p className="text-green-100 text-sm">J'ai un code ou je connais le nom de mon équipe</p>
              </button>
            </div>
          </div>
        )}

        {/* ─── ÉCRAN CRÉATION D'ÉQUIPE ─── */}
        {step === 'create' && (
          <div className="bg-slate-800/60 backdrop-blur border border-white/10 rounded-2xl p-6">
            <button
              onClick={() => setStep(pendingRequests.length > 0 ? 'pending' : 'choice')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
            >
              <ArrowLeft size={20} />
              <span>Retour</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Sparkles className="text-blue-400" size={20} />
              </div>
              <h2 className="text-2xl font-bold text-white">Créer votre équipe</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2 font-medium text-sm">Nom de l'équipe *</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Mad Dogs"
                  className="w-full bg-slate-700 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-medium text-sm">Sport *</label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="w-full bg-slate-700 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sélectionnez un sport</option>
                  {sports.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-medium text-sm">Description (optionnel)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Quelques mots sur votre équipe..."
                  rows={3}
                  className="w-full bg-slate-700 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                onClick={handleCreateTeam}
                disabled={creating}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition"
              >
                {creating ? <><Loader className="animate-spin" size={20} /><span>Création...</span></> : <><Plus size={20} /><span>Créer l'équipe</span></>}
              </button>
            </div>
          </div>
        )}

        {/* ─── ÉCRAN REJOINDRE ─── */}
        {step === 'join' && (
          <div className="bg-slate-800/60 backdrop-blur border border-white/10 rounded-2xl p-6">
            <button
              onClick={() => { resetJoinForm(); setStep(pendingRequests.length > 0 ? 'pending' : 'choice') }}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
            >
              <ArrowLeft size={20} />
              <span>Retour</span>
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <LogIn className="text-green-400" size={20} />
              </div>
              <h2 className="text-2xl font-bold text-white">Rejoindre une équipe</h2>
            </div>

            {/* Tabs code / nom */}
            <div className="flex gap-2 mb-5 bg-slate-700/50 p-1 rounded-xl">
              <button
                onClick={() => { setSearchMode('code'); resetJoinForm() }}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2 ${
                  searchMode === 'code' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Hash size={16} />
                Code
              </button>
              <button
                onClick={() => { setSearchMode('name'); resetJoinForm() }}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-2 ${
                  searchMode === 'name' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Search size={16} />
                Nom
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              {searchMode === 'code'
                ? 'Demandez le code 6 chiffres à un manager de votre équipe'
                : 'Cherchez votre équipe par son nom'}
            </p>

            <div className="flex gap-2 mb-5">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={searchMode === 'code' ? '123456' : 'Mad Dogs...'}
                className="flex-1 bg-slate-700 text-white border border-gray-600 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500"
                maxLength={searchMode === 'code' ? 6 : undefined}
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-semibold transition flex items-center gap-2"
              >
                {searching ? <Loader className="animate-spin" size={18} /> : <Search size={18} />}
              </button>
            </div>

            {searched && (
              searchResults.length === 0 ? (
                <div className="bg-slate-700/30 rounded-xl p-8 text-center">
                  <Users className="text-gray-600 mx-auto mb-3" size={40} />
                  <p className="text-white font-semibold mb-1">Aucune équipe trouvée</p>
                  <p className="text-gray-400 text-sm">
                    {searchMode === 'code' ? 'Vérifiez le code et réessayez' : 'Essayez une autre recherche'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((team) => (
                    <div key={team.id} className="bg-slate-700/50 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold truncate">{team.name}</p>
                        <p className="text-gray-400 text-xs">{team.sport} · {team.member_count} membre{team.member_count > 1 ? 's' : ''} · #{team.team_code}</p>
                        {team.description && <p className="text-gray-500 text-xs mt-1 truncate">{team.description}</p>}
                      </div>
                      <button
                        onClick={() => handleRequestJoin(team.id, team.name)}
                        disabled={joining}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shrink-0"
                      >
                        {joining ? <Loader className="animate-spin" size={14} /> : <CheckCircle size={14} />}
                        Rejoindre
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}

      </div>
    </div>
  )
}
