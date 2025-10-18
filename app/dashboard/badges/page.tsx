'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Award, Trophy, Zap, Target, Shield, Crown, TrendingUp, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type Badge = {
  id: string
  badge_type: string
  earned_at: string
  season_name?: string
  metadata?: Record<string, unknown>
}

const BADGE_CONFIG: Record<string, { 
  name: string
  description: string
  icon: typeof Trophy
  color: string
}> = {
  'hat_trick': {
    name: 'Hat-trick',
    description: '3 TOP consécutifs',
    icon: Trophy,
    color: 'from-yellow-500 to-orange-500'
  },
  'comeback_king': {
    name: 'Comeback King',
    description: 'Passer de FLOP à TOP en 2 matchs',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-500'
  },
  'untouchable': {
    name: 'Intouchable',
    description: 'Aucun FLOP sur une saison',
    icon: Shield,
    color: 'from-blue-500 to-cyan-500'
  },
  'polarizing': {
    name: 'Polarisant',
    description: 'Même nombre de TOP et FLOP',
    icon: Zap,
    color: 'from-purple-500 to-pink-500'
  },
  'regular': {
    name: 'Régulier',
    description: 'A voté à 100% des matchs d\'une saison',
    icon: Target,
    color: 'from-indigo-500 to-blue-500'
  },
  'mvp_season': {
    name: 'MVP de la saison',
    description: 'Meilleur joueur de la saison',
    icon: Crown,
    color: 'from-amber-500 to-yellow-500'
  },
  'prediction_master': {
    name: 'Oracle',
    description: '5 prédictions correctes d\'affilée',
    icon: Star,
    color: 'from-violet-500 to-purple-500'
  }
}

export default function BadgesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [myBadges, setMyBadges] = useState<Badge[]>([])
  const [userName, setUserName] = useState('')

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

      // Récupérer le profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, nickname')
        .eq('id', user.id)
        .single()

      const displayName = profile?.nickname || 
                         (profile?.first_name && profile?.last_name 
                           ? `${profile.first_name} ${profile.last_name}` 
                           : 'Vous')
      setUserName(displayName)

      // Récupérer l'équipe
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        router.push('/dashboard')
        return
      }

      // Récupérer mes badges
      const { data: badgesData } = await supabase
        .from('player_badges')
        .select(`
          id,
          badge_type,
          earned_at,
          metadata,
          seasons (
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('team_id', membership.team_id)
        .order('earned_at', { ascending: false })

      if (badgesData) {
        const formattedBadges = badgesData.map(b => {
          const seasonData = Array.isArray(b.seasons) ? b.seasons[0] : b.seasons
          return {
            id: b.id,
            badge_type: b.badge_type,
            earned_at: b.earned_at,
            season_name: seasonData?.name,
            metadata: b.metadata as Record<string, unknown> | undefined
          }
        })
        setMyBadges(formattedBadges)
      }

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  const earnedBadgeTypes = new Set(myBadges.map(b => b.badge_type))
  const allBadgeTypes = Object.keys(BADGE_CONFIG)
  const lockedBadges = allBadgeTypes.filter(type => !earnedBadgeTypes.has(type))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
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
        
        {/* En-tête avec stats */}
        <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-8 mb-8 text-center">
          <Award className="mx-auto mb-4 text-yellow-400" size={64} />
          <h2 className="text-3xl font-bold text-white mb-2">{userName}</h2>
          <p className="text-gray-400 mb-4">Vos réalisations</p>
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-4xl font-bold text-yellow-400">{myBadges.length}</p>
              <p className="text-gray-400 text-sm">Badges débloqués</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-500">{lockedBadges.length}</p>
              <p className="text-gray-400 text-sm">Badges à débloquer</p>
            </div>
          </div>
        </div>

        {/* Badges débloqués */}
        {myBadges.length > 0 && (
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-white mb-4">🏆 Badges Débloqués</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myBadges.map((badge) => {
                const config = BADGE_CONFIG[badge.badge_type]
                if (!config) return null
                
                const Icon = config.icon

                return (
                  <div 
                    key={badge.id}
                    className={`bg-gradient-to-br ${config.color} p-1 rounded-2xl`}
                  >
                    <div className="bg-slate-900 rounded-xl p-6 h-full">
                      <div className="flex items-center justify-between mb-4">
                        <Icon className="text-white" size={40} />
                        <span className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded-full">
                          Débloqué
                        </span>
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">{config.name}</h4>
                      <p className="text-gray-400 text-sm mb-4">{config.description}</p>
                      <div className="text-xs text-gray-500">
                        {badge.season_name && <p>Saison : {badge.season_name}</p>}
                        <p>Obtenu le {new Date(badge.earned_at).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Badges verrouillés */}
        {lockedBadges.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">🔒 Badges à Débloquer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedBadges.map((badgeType) => {
                const config = BADGE_CONFIG[badgeType]
                const Icon = config.icon

                return (
                  <div 
                    key={badgeType}
                    className="bg-slate-800/30 border border-gray-700/50 rounded-2xl p-6 opacity-60"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Icon className="text-gray-600" size={40} />
                      <span className="bg-gray-700/50 text-gray-400 text-xs px-2 py-1 rounded-full">
                        Verrouillé
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-gray-500 mb-2">{config.name}</h4>
                    <p className="text-gray-600 text-sm">{config.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {myBadges.length === 0 && (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Award className="mx-auto mb-4 text-gray-600" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Aucun badge pour le moment</h2>
            <p className="text-gray-400">
              Continuez à jouer et à voter pour débloquer vos premiers badges !
            </p>
          </div>
        )}
      </div>
    </div>
  )
}