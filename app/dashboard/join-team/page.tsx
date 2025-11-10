'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Search, Users, Loader, Hash, CheckCircle } from 'lucide-react'

type Team = {
  id: string
  name: string
  sport: string
  team_code: string
  description?: string
  member_count: number
}

export default function JoinTeamPage() {
  const router = useRouter()
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Team[]>([])
  const [loading, setLoading] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('Veuillez entrer un code ou un nom d\'équipe')
      return
    }

    try {
      setLoading(true)
      setSearched(true)

      const query = searchQuery.trim()

      // Rechercher par code (6 chiffres exactement) OU par nom (insensible à la casse)
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('id, name, sport, team_code, description')
        .or(`team_code.eq.${query},name.ilike.%${query}%`)

      if (error) throw error

      if (!teamsData || teamsData.length === 0) {
        setSearchResults([])
        return
      }

      // Compter les membres de chaque équipe
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
      setLoading(false)
    }
  }

  const handleRequestJoin = async (teamId: string, teamName: string) => {
    try {
      setRequesting(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Vous devez être connecté')
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
        } else if (existingRequest.status === 'approved') {
          alert('Vous êtes déjà membre de cette équipe')
        } else if (existingRequest.status === 'rejected') {
          alert('Votre demande précédente a été refusée. Veuillez contacter le manager de l\'équipe.')
        }
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
      setRequesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={20} />
            <span>Retour</span>
          </button>
          <h1 className="text-3xl font-bold text-white">Rejoindre une équipe</h1>
        </div>

        {/* Instructions */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
            <Users size={24} />
            Comment rejoindre une équipe ?
          </h2>
          <div className="space-y-2 text-gray-300">
            <p className="flex items-start gap-2">
              <Hash className="text-blue-400 mt-1 flex-shrink-0" size={18} />
              <span><strong className="text-white">Option 1 :</strong> Demandez le <strong className="text-blue-400">code à 6 chiffres</strong> à un manager de l'équipe</span>
            </p>
            <p className="flex items-start gap-2">
              <Search className="text-blue-400 mt-1 flex-shrink-0" size={18} />
              <span><strong className="text-white">Option 2 :</strong> Recherchez l'équipe par son <strong className="text-blue-400">nom</strong></span>
            </p>
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6 mb-8">
          <label className="block text-white font-semibold mb-3">
            Code d'équipe ou nom de l'équipe
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ex: 123456 ou Mad Dogs"
              className="flex-1 bg-slate-700 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  Recherche...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Rechercher
                </>
              )}
            </button>
          </div>
        </div>

        {/* Résultats de recherche */}
        {searched && (
          <div>
            {searchResults.length === 0 ? (
              <div className="bg-slate-800/50 border border-white/10 rounded-xl p-12 text-center">
                <Users className="text-gray-600 mx-auto mb-4" size={64} />
                <h2 className="text-2xl font-bold text-white mb-2">Aucune équipe trouvée</h2>
                <p className="text-gray-400">
                  Vérifiez le code ou le nom de l'équipe et réessayez
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-white mb-4">
                  {searchResults.length} équipe{searchResults.length > 1 ? 's' : ''} trouvée{searchResults.length > 1 ? 's' : ''}
                </h2>
                
                {searchResults.map((team) => (
                  <div
                    key={team.id}
                    className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-2xl font-bold text-white mb-2">{team.name}</h3>
                        <p className="text-purple-300 mb-3">{team.sport}</p>
                        
                        {team.description && (
                          <p className="text-gray-400 mb-3">{team.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-2">
                            <Users size={16} />
                            {team.member_count} membre{team.member_count > 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-2">
                            <Hash size={16} />
                            Code: <span className="text-blue-400 font-mono font-bold">{team.team_code}</span>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRequestJoin(team.id, team.name)}
                        disabled={requesting}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 disabled:opacity-50"
                      >
                        <CheckCircle size={20} />
                        Demander à rejoindre
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}