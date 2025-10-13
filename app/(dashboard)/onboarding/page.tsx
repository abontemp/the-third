'use client'

import { useState } from 'react'
import { Plus, Search, ArrowRight, X, AlertCircle, CheckCircle, Loader } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState('choice')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [createForm, setCreateForm] = useState({
    teamName: '',
    sport: '',
    description: ''
  })

  const [searchQuery, setSearchQuery] = useState('')
const [searchResults, setSearchResults] = useState<Array<{
  id: string
  name: string
  sport: string
  description?: string
}>>([]) 
const [searching, setSearching] = useState(false)

  const sports = [
    'Football', 'Basketball', 'Volleyball', 'Handball', 'Rugby',
    'Tennis', 'Badminton', 'Hockey', 'Baseball', 'Autre'
  ]

  const handleCreateTeam = async () => {
    if (!createForm.teamName.trim()) {
      setError("Le nom de l'équipe est obligatoire")
      return
    }
    if (!createForm.sport) {
      setError('Veuillez sélectionner un sport')
      return
    }

    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) throw new Error('Vous devez être connecté')

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([{
          name: createForm.teamName,
          sport: createForm.sport,
          description: createForm.description,
          creator_id: user.id
        }])
        .select()
        .single()

      if (teamError) throw teamError

      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: team.id,
          user_id: user.id,
          role: 'creator'
        }])

      if (memberError) throw memberError

      setSuccess('Équipe créée avec succès !')
      setTimeout(() => router.push('/dashboard'), 1500)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création")
    } finally {
      setLoading(false)
    }
  }

const handleSearchTeams = async () => {
    setSearching(true)
    setError('')
    setSearchResults([])

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, sport, description')
        .limit(50) // Limite à 50 équipes

      if (error) throw error
      setSearchResults(data || [])
      if (data && data.length === 0) setError('Aucune équipe disponible')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSearching(false)
    }
  }

const handleJoinRequest = async (teamId: string, teamName: string) => {
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Vous devez être connecté')

      // Rejoindre directement l'équipe (sans validation)
      const { error: memberError } = await supabase
        .from('team_members')
        .insert([{
          team_id: teamId,
          user_id: user.id,
          role: 'member'
        }])

      if (memberError) throw memberError

      setSuccess(`Vous avez rejoint "${teamName}" !`)
      
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }

  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              Bienvenue sur The Third ! 🎉
            </h1>
            <p className="text-xl text-gray-300">
              Commencez en créant ou rejoignant une équipe
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button
              onClick={() => setStep('create')}
              className="group bg-gradient-to-br from-orange-900/30 to-red-900/30 border-2 border-orange-500/30 hover:border-orange-500 rounded-2xl p-8 transition-all hover:scale-105"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Plus className="text-white" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Créer une équipe</h2>
              <p className="text-gray-300 mb-6">
                Créez votre équipe et invitez vos coéquipiers
              </p>
              <div className="flex items-center justify-center gap-2 text-orange-400 font-semibold">
                <span>Commencer</span>
                <ArrowRight size={20} />
              </div>
            </button>

            <button
              onClick={() => setStep('join')}
              className="group bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-2 border-blue-500/30 hover:border-blue-500 rounded-2xl p-8 transition-all hover:scale-105"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Search className="text-white" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Rejoindre une équipe</h2>
              <p className="text-gray-300 mb-6">
                Recherchez et rejoignez une équipe existante
              </p>
              <div className="flex items-center justify-center gap-2 text-blue-400 font-semibold">
                <span>Rechercher</span>
                <ArrowRight size={20} />
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'create') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <button onClick={() => setStep('choice')} className="mb-6 text-gray-400 hover:text-white transition flex items-center gap-2">
            <X size={20} />
            <span>Retour</span>
          </button>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Créer votre équipe</h1>
              <p className="text-gray-400">Vous deviendrez le manager</p>
            </div>

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

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom de l&apos;équipe *
                </label>
                <input
                  type="text"
                  value={createForm.teamName}
                  onChange={(e) => setCreateForm({ ...createForm, teamName: e.target.value })}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="Les Guerriers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Sport *</label>
                <select
                  value={createForm.sport}
                  onChange={(e) => setCreateForm({ ...createForm, sport: e.target.value })}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                >
                  <option value="">Sélectionnez un sport</option>
                  {sports.map(sport => (
                    <option key={sport} value={sport}>{sport}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={4}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white resize-none"
                  placeholder="Notre équipe..."
                />
              </div>

              <button
                onClick={handleCreateTeam}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? 'Création...' : 'Créer mon équipe'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <button onClick={() => setStep('choice')} className="mb-6 text-gray-400 hover:text-white transition flex items-center gap-2">
            <X size={20} />
            <span>Retour</span>
          </button>

          <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Rejoindre une équipe</h1>
              <p className="text-gray-400">Recherchez par nom</p>
            </div>

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

            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchTeams()}
                  className="flex-1 bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="Nom de l'équipe..."
                />
                <button
                  onClick={handleSearchTeams}
                  disabled={searching}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  {searching ? <Loader className="animate-spin" size={20} /> : 'Rechercher'}
                </button>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Résultats ({searchResults.length})</h3>
                {searchResults.map(team => (
                  <div key={team.id} className="bg-slate-700/30 border border-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-lg font-bold text-white">{team.name}</h4>
                        <p className="text-sm text-blue-400">{team.sport}</p>
                        {team.description && <p className="text-sm text-gray-400 mt-1">{team.description}</p>}
                      </div>
                      <button
                        onClick={() => handleJoinRequest(team.id, team.name)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                      >
                        Rejoindre
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}