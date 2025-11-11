'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Users, Plus, LogIn, Loader, Search, Hash, CheckCircle, ArrowLeft } from 'lucide-react'

type Team = {
  id: string
  name: string
  sport: string
  team_code: string
  description?: string
  member_count: number
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<'choice' | 'create' | 'join'>('choice')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [searching, setSearching] = useState(false)

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

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !sport) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }

    try {
      setCreating(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Créer l'équipe (le trigger génère automatiquement le team_code)
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([{
          name: teamName.trim(),
          sport: sport,
          description: description.trim() || null
        }])
        .select()
        .single()

      if (teamError) throw teamError

      // Créer une saison par défaut
      const currentYear = new Date().getFullYear()
      const { data: season, error: seasonError } = await supabase
        .from('seasons')
        .insert([{
          team_id: team.id,
          name: `Saison ${currentYear}`,
          is_active: true
        }])
        .select()
        .single()

      if (seasonError) throw seasonError

      // Ajouter l'utilisateur comme créateur
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: team.id,
          user_id: user.id,
          role: 'creator'
        }])

      if (memberError) throw memberError

      alert(`✅ Équipe "${teamName}" créée avec succès !`)
      router.push('/dashboard')

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la création de l\'équipe')
    } finally {
      setCreating(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('Veuillez entrer un code ou un nom d\'équipe')
      return
    }

    try {
      setSearching(true)
      setSearched(true)

      const query = searchQuery.trim()

      // Rechercher par code OU par nom (insensible à la casse)
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('id, name, sport, team_code, description')
        .or(`team_code.eq.${query},name.ilike.%${query}%`)

      if (error) throw error

      if (!teamsData || teamsData.length === 0) {
        setSearchResults([])
        return
      }

      // Compter les membres
      const teamsWithCounts = await Promise.all(
        teamsData.map(async (team) => {
          const { count } = await supabase
            .from('team_members')
            .select('*', { count: 'exact', head: true })
            .eq('team_id', team.id)

          return {
            ...team,
            member_count: count || 0
          }
        })
      )

      setSearchResults(teamsWithCounts)

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la recherche')
    } finally {
      setSearching(false)
    }
  }

  const handleRequestJoin = async (teamId: string, teamName: string) => {
    try {
      setJoining(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Vérifier si déjà membre
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (existingMember) {
        alert('Vous êtes déjà membre de cette équipe')
        router.push('/dashboard')
        return
      }

      // Vérifier si une demande existe déjà
      const { data: existingRequest } = await supabase
        .from('join_requests')
        .select('id, status')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single()

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          alert('Vous avez déjà une demande en attente pour cette équipe')
        } else if (existingRequest.status === 'rejected') {
          alert('Votre demande précédente a été refusée')
        }
        return
      }

      // Créer la demande
      const { error } = await supabase
        .from('join_requests')
        .insert([{
          team_id: teamId,
          user_id: user.id,
          status: 'pending'
        }])

      if (error) throw error

      alert(`✅ Demande envoyée à l'équipe "${teamName}" !`)
      router.push('/dashboard')

    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de l\'envoi de la demande')
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        
        {/* ÉCRAN DE CHOIX */}
        {step === 'choice' && (
          <div className="text-center">
            <div className="mb-8">
              <h1 className="text-5xl font-bold text-white mb-4">
                Bienvenue sur The Third ! 🏆
              </h1>
              <p className="text-xl text-gray-300">
                Commencez par créer ou rejoindre une équipe
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Créer une équipe */}
              <button
                onClick={() => setStep('create')}
                className="bg-gradient-to-br from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-8 rounded-2xl transition transform hover:scale-105 shadow-2xl"
              >
                <Plus className="mx-auto mb-4" size={64} />
                <h2 className="text-2xl font-bold mb-2">Créer une équipe</h2>
                <p className="text-blue-100">
                  Vous êtes manager ? Créez votre équipe et invitez vos joueurs
                </p>
              </button>

              {/* Rejoindre une équipe */}
              <button
                onClick={() => setStep('join')}
                className="bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-8 rounded-2xl transition transform hover:scale-105 shadow-2xl"
              >
                <LogIn className="mx-auto mb-4" size={64} />
                <h2 className="text-2xl font-bold mb-2">Rejoindre une équipe</h2>
                <p className="text-green-100">
                  Vous avez un code ou connaissez le nom de votre équipe ?
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ÉCRAN CRÉATION D'ÉQUIPE */}
        {step === 'create' && (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
            <button
              onClick={() => setStep('choice')}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
            >
              <ArrowLeft size={20} />
              <span>Retour</span>
            </button>

            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <Plus size={32} />
              Créer votre équipe
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-2 font-semibold">
                  Nom de l'équipe *
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Mad Dogs"
                  className="w-full bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">
                  Sport *
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  className="w-full bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sélectionnez un sport</option>
                  {sports.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-300 mb-2 font-semibold">
                  Description (optionnel)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Quelques mots sur votre équipe..."
                  rows={3}
                  className="w-full bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                onClick={handleCreateTeam}
                disabled={creating}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition"
              >
                {creating ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    <span>Création...</span>
                  </>
                ) : (
                  <>
                    <Plus size={20} />
                    <span>Créer l'équipe</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ÉCRAN REJOINDRE UNE ÉQUIPE */}
        {step === 'join' && (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
            <button
              onClick={() => {
                setStep('choice')
                setSearched(false)
                setSearchResults([])
                setSearchQuery('')
              }}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition"
            >
              <ArrowLeft size={20} />
              <span>Retour</span>
            </button>

            <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
              <LogIn size={32} />
              Rejoindre une équipe
            </h2>

            {/* Choix du mode de recherche */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => {
                  setSearchMode('code')
                  setSearched(false)
                  setSearchResults([])
                  setSearchQuery('')
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  searchMode === 'code'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-gray-400 hover:text-white'
                }`}
              >
                <Hash size={20} />
                Code à 6 chiffres
              </button>
              <button
                onClick={() => {
                  setSearchMode('name')
                  setSearched(false)
                  setSearchResults([])
                  setSearchQuery('')
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
                  searchMode === 'name'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-gray-400 hover:text-white'
                }`}
              >
                <Search size={20} />
                Nom de l'équipe
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
              {searchMode === 'code' ? (
                <p className="text-gray-300 text-sm">
                  <Hash className="inline text-blue-400 mr-1" size={16} />
                  Demandez le <strong className="text-blue-400">code à 6 chiffres</strong> à un manager de votre équipe
                </p>
              ) : (
                <p className="text-gray-300 text-sm">
                  <Search className="inline text-green-400 mr-1" size={16} />
                  Entrez le <strong className="text-green-400">nom de votre équipe</strong> (recherche insensible à la casse)
                </p>
              )}
            </div>

            {/* Barre de recherche */}
            <div className="mb-6">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={searchMode === 'code' ? 'Ex: 123456' : 'Ex: Mad Dogs'}
                  className="flex-1 bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                  maxLength={searchMode === 'code' ? 6 : undefined}
                />
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50"
                >
                  {searching ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      <span className="hidden sm:inline">Recherche...</span>
                    </>
                  ) : (
                    <>
                      <Search size={20} />
                      <span className="hidden sm:inline">Rechercher</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Résultats */}
            {searched && (
              <div>
                {searchResults.length === 0 ? (
                  <div className="bg-slate-700/30 rounded-xl p-8 text-center">
                    <Users className="text-gray-600 mx-auto mb-3" size={48} />
                    <p className="text-white font-semibold mb-1">Aucune équipe trouvée</p>
                    <p className="text-gray-400 text-sm">
                      {searchMode === 'code' 
                        ? 'Vérifiez le code et réessayez' 
                        : 'Essayez une autre recherche ou utilisez le code'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-400 text-sm mb-4">
                      {searchResults.length} équipe{searchResults.length > 1 ? 's' : ''} trouvée{searchResults.length > 1 ? 's' : ''}
                    </p>

                    {searchResults.map((team) => (
                      <div
                        key={team.id}
                        className="bg-slate-700/50 border border-white/10 rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-white mb-1">{team.name}</h3>
                            <p className="text-purple-300 text-sm mb-2">{team.sport}</p>
                            {team.description && (
                              <p className="text-gray-400 text-sm mb-2">{team.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Users size={14} />
                                {team.member_count} membre{team.member_count > 1 ? 's' : ''}
                              </span>
                              <span className="flex items-center gap-1">
                                <Hash size={14} />
                                Code: <span className="text-blue-400 font-mono">{team.team_code}</span>
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRequestJoin(team.id, team.name)}
                            disabled={joining}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50"
                          >
                            <CheckCircle size={18} />
                            <span className="hidden sm:inline">Rejoindre</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}