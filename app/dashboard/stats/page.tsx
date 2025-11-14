'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, TrendingUp, Trophy, ThumbsDown } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

type PlayerStat = {
  player_id: string
  player_name: string
  top_count: number
  flop_count: number
  total: number
}

function StatsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<PlayerStat[]>([])

  useEffect(() => {
    loadStats()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async () => {
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

      // Récupérer tous les membres
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', teamId)

      if (!members || members.length === 0) {
        setStats([])
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

      // Statistiques simulées (à remplacer par vraie logique avec comptage des votes)
      const mockStats: PlayerStat[] = members.map(m => ({
        player_id: m.user_id,
        player_name: profilesMap[m.user_id] || 'Inconnu',
        top_count: Math.floor(Math.random() * 15),
        flop_count: Math.floor(Math.random() * 10),
        total: 0
      })).map(s => ({
        ...s,
        total: s.top_count + s.flop_count
      })).sort((a, b) => b.total - a.total)

      setStats(mockStats)

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
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
              <TrendingUp size={24} />
              Statistiques
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <h2 className="text-2xl font-bold text-white mb-6">Statistiques de l&apos;équipe</h2>

        {stats.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <TrendingUp className="mx-auto mb-4 text-gray-600" size={64} />
            <p className="text-gray-400">Aucune statistique disponible</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stats.map((stat, index) => (
              <div 
                key={stat.player_id}
                className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6"
              >
                <div className="flex items-center gap-4">
                  <div className={`text-2xl font-bold ${
                    index === 0 ? 'text-yellow-400' :
                    index === 1 ? 'text-gray-300' :
                    index === 2 ? 'text-orange-600' :
                    'text-gray-500'
                  }`}>
                    #{index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{stat.player_name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="text-green-400" size={18} />
                        <span className="text-green-400 font-semibold">{stat.top_count} TOP</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ThumbsDown className="text-red-400" size={18} />
                        <span className="text-red-400 font-semibold">{stat.flop_count} FLOP</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{stat.total}</p>
                    <p className="text-sm text-gray-400">votes totaux</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StatsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    }>
      <StatsContent />
    </Suspense>
  )
}