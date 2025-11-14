'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Award } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

type Badge = {
  id: string
  badge_name: string
  earned_at: string
  player_name: string
}

function BadgesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [badges, setBadges] = useState<Badge[]>([])
  const [myBadges, setMyBadges] = useState<Badge[]>([])

  useEffect(() => {
    loadBadges()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadBadges = async () => {
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

      // Récupérer tous les badges de l'équipe
      const { data: badgesData } = await supabase
        .from('player_badges')
        .select('id, badge_name, earned_at, player_id')
        .eq('team_id', teamId)
        .order('earned_at', { ascending: false })

      if (!badgesData || badgesData.length === 0) {
        setBadges([])
        setMyBadges([])
        setLoading(false)
        return
      }

      // Récupérer les profils
      const playerIds = [...new Set(badgesData.map(b => b.player_id))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .in('id', playerIds)

      const profilesMap: Record<string, string> = {}
      profilesData?.forEach(p => {
        profilesMap[p.id] = p.nickname || 
                           (p.first_name && p.last_name 
                             ? `${p.first_name} ${p.last_name}` 
                             : 'Joueur')
      })

      const formattedBadges = badgesData.map(b => ({
        id: b.id,
        badge_name: b.badge_name,
        earned_at: b.earned_at,
        player_name: profilesMap[b.player_id] || 'Inconnu'
      }))

      setBadges(formattedBadges)
      setMyBadges(formattedBadges.filter(b => badgesData.find(bd => bd.id === b.id)?.player_id === user.id))

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900 to-slate-900">
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
              <Award size={24} />
              Mes Badges
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Mes badges */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Mes badges ({myBadges.length})</h2>
          {myBadges.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8 text-center">
              <Award className="mx-auto mb-4 text-gray-600" size={48} />
              <p className="text-gray-400">Vous n&apos;avez pas encore de badges</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {myBadges.map((badge) => (
                <div key={badge.id} className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-xl p-6 text-center">
                  <Award className="mx-auto mb-3 text-yellow-400" size={48} />
                  <h3 className="text-lg font-bold text-white mb-1">{badge.badge_name}</h3>
                  <p className="text-sm text-gray-400">
                    {new Date(badge.earned_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tous les badges de l'équipe */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Tous les badges de l&apos;équipe</h2>
          {badges.length === 0 ? (
            <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8 text-center">
              <Award className="mx-auto mb-4 text-gray-600" size={48} />
              <p className="text-gray-400">Aucun badge n&apos;a encore été attribué</p>
            </div>
          ) : (
            <div className="space-y-3">
              {badges.map((badge) => (
                <div key={badge.id} className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-4 flex items-center gap-4">
                  <Award className="text-yellow-400" size={32} />
                  <div className="flex-1">
                    <h3 className="font-bold text-white">{badge.badge_name}</h3>
                    <p className="text-sm text-gray-400">{badge.player_name}</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(badge.earned_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BadgesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-yellow-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    }>
      <BadgesContent />
    </Suspense>
  )
}