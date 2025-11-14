'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Swords, TrendingUp, TrendingDown } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

type Rivalry = {
  player_id: string
  player_name: string
  interactions: number
  type: 'rival' | 'supporter'
}

function RivalriesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [rivals, setRivals] = useState<Rivalry[]>([])
  const [supporters, setSupporters] = useState<Rivalry[]>([])

  useEffect(() => {
    loadRivalries()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRivalries = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer le team_id depuis l'URL
      let teamId = searchParams.get('team_id')
      console.log('🔗 Team ID depuis URL:', teamId)

      if (!teamId) {
        teamId = localStorage.getItem('current_team_id')
        console.log('📦 Team ID depuis localStorage:', teamId)
      }

      if (!teamId) {
        const { data: memberships } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .limit(1)

        if (!memberships || memberships.length === 0) {
          setLoading(false)
          return
        }

        teamId = memberships[0].team_id
      }

      console.log('✅ Équipe trouvée:', teamId)

      // Pour cet exemple simplifié, on simule des données
      // En production, vous auriez des vraies requêtes pour calculer les rivalités
      
      // Récupérer tous les membres de l'équipe
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)
        .neq('user_id', user.id)

      if (!members || members.length === 0) {
        setRivals([])
        setSupporters([])
        setLoading(false)
        return
      }

      // Récupérer les profils
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .in('id', members.map(m => m.user_id))

      const profilesMap: Record<string, string> = {}
      profilesData?.forEach(p => {
        profilesMap[p.id] = p.nickname || 
                           (p.first_name && p.last_name 
                             ? `${p.first_name} ${p.last_name}` 
                             : 'Joueur')
      })

      // Exemple de rivalités simulées (à remplacer par vraie logique)
      const mockRivals: Rivalry[] = members.slice(0, 3).map(m => ({
        player_id: m.user_id,
        player_name: profilesMap[m.user_id] || 'Inconnu',
        interactions: Math.floor(Math.random() * 20) + 5,
        type: 'rival'
      }))

      const mockSupporters: Rivalry[] = members.slice(3, 6).map(m => ({
        player_id: m.user_id,
        player_name: profilesMap[m.user_id] || 'Inconnu',
        interactions: Math.floor(Math.random() * 20) + 5,
        type: 'supporter'
      }))

      setRivals(mockRivals)
      setSupporters(mockSupporters)

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900">
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft size={20} />
              <span>Retour au dashboard</span>
            </button>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Swords size={24} />
              Rivalités & Duels
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Mes rivaux */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingDown className="text-red-400" size={28} />
            Mes rivaux ({rivals.length})
          </h2>
          {rivals.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8 text-center">
              <Swords className="mx-auto mb-4 text-gray-600" size={48} />
              <p className="text-gray-400">Aucune rivalité pour le moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rivals.map((rival) => (
                <div key={rival.player_id} className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">{rival.player_name}</h3>
                    <Swords className="text-red-400" size={24} />
                  </div>
                  <p className="text-sm text-gray-400">{rival.interactions} interactions</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mes supporters */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="text-green-400" size={28} />
            Mes supporters ({supporters.length})
          </h2>
          {supporters.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8 text-center">
              <TrendingUp className="mx-auto mb-4 text-gray-600" size={48} />
              <p className="text-gray-400">Aucun supporter pour le moment</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {supporters.map((supporter) => (
                <div key={supporter.player_id} className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">{supporter.player_name}</h3>
                    <TrendingUp className="text-green-400" size={24} />
                  </div>
                  <p className="text-sm text-gray-400">{supporter.interactions} votes positifs</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function RivalriesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    }>
      <RivalriesContent />
    </Suspense>
  )
}