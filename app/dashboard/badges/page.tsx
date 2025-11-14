'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Award, Trophy, Zap, Target, Shield, Crown, TrendingUp, Star, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type Badge = {
  id: string
  user_id: string
  badge_type: string
  earned_at: string
  player_name: string
}

type BadgeDefinition = {
  id: string
  name: string
  description: string
  criteria: string
  icon: typeof Trophy
  color: string
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'hat_trick',
    name: 'Hat-trick',
    description: '3 votes TOP consécutifs',
    criteria: 'Obtenir 3 votes TOP d\'affilée dans 3 matchs consécutifs',
    icon: Trophy,
    color: 'from-yellow-500 to-orange-500'
  },
  {
    id: 'comeback_king',
    name: 'Comeback King',
    description: 'Remonter de FLOP à TOP rapidement',
    criteria: 'Passer d\'un vote FLOP à un vote TOP en seulement 2 matchs',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 'untouchable',
    name: 'Intouchable',
    description: 'Aucun vote FLOP sur toute la vie de l\'équipe',
    criteria: 'Ne jamais recevoir de vote FLOP depuis votre arrivée dans l\'équipe',
    icon: Shield,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'polarizing',
    name: 'Polarisant',
    description: 'Autant aimé que détesté',
    criteria: 'Avoir exactement le même nombre de votes TOP et FLOP (minimum 5 de chaque)',
    icon: Zap,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 'regular',
    name: 'Assidu',
    description: 'Voter sans jamais manquer',
    criteria: 'Voter à 100% des sessions de vote auxquelles vous étiez invité (minimum 10 votes)',
    icon: Target,
    color: 'from-indigo-500 to-blue-500'
  },
  {
    id: 'mvp',
    name: 'MVP',
    description: 'Meilleur joueur de tous les temps',
    criteria: 'Avoir le plus grand nombre de votes TOP dans toute l\'histoire de l\'équipe',
    icon: Crown,
    color: 'from-amber-500 to-yellow-500'
  },
  {
    id: 'oracle',
    name: 'Oracle',
    description: 'Prévoir l\'avenir avec précision',
    criteria: 'Faire 5 prédictions correctes consécutives (TOP ou FLOP)',
    icon: Star,
    color: 'from-violet-500 to-purple-500'
  }
]

export default function BadgesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [isManager, setIsManager] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [userName, setUserName] = useState('')
  const [myBadges, setMyBadges] = useState<string[]>([])
  const [allTeamBadges, setAllTeamBadges] = useState<Badge[]>([])
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      console.log('🔍 Chargement des badges...')
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setCurrentUserId(user.id)

      // Récupérer le profil et l'équipe
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

      // Récupérer l'équipe de l'utilisateur
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        console.log('❌ Pas de membership')
        return
      }

      setTeamId(membership.team_id)
      setIsManager(membership.role === 'creator' || membership.role === 'manager')

      // Récupérer tous les badges de l'équipe (si manager)
      if (membership.role === 'creator' || membership.role === 'manager') {
        const { data: teamBadges } = await supabase
          .from('player_badges')
          .select('id, user_id, badge_type, earned_at')
          .eq('team_id', membership.team_id)

        if (teamBadges && teamBadges.length > 0) {
          // Récupérer les noms des joueurs
          const userIds = [...new Set(teamBadges.map(b => b.user_id))]
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, nickname')
            .in('id', userIds)

          const profilesMap: Record<string, string> = {}
          profiles?.forEach(p => {
            profilesMap[p.id] = p.nickname || 
                               (p.first_name && p.last_name 
                                 ? `${p.first_name} ${p.last_name}` 
                                 : 'Joueur inconnu')
          })

          const badgesWithNames = teamBadges.map(b => ({
            ...b,
            player_name: profilesMap[b.user_id] || 'Joueur inconnu'
          }))

          setAllTeamBadges(badgesWithNames)
        }
      }

      // Récupérer MES badges
      const { data: userBadges } = await supabase
        .from('player_badges')
        .select('badge_type')
        .eq('user_id', user.id)
        .eq('team_id', membership.team_id)

      const myBadgeTypes = userBadges?.map(b => b.badge_type) || []
      setMyBadges(myBadgeTypes)

      console.log('✅ Badges chargés:', myBadgeTypes)

    } catch (error) {
      console.error('❌ Erreur:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleBadgeExpansion = (badgeId: string) => {
    if (expandedBadge === badgeId) {
      setExpandedBadge(null)
    } else {
      setExpandedBadge(badgeId)
    }
  }

  const getBadgeHolders = (badgeType: string): Badge[] => {
    return allTeamBadges.filter(b => b.badge_type === badgeType)
  }

  const hasBadge = (badgeType: string): boolean => {
    return myBadges.includes(badgeType)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-white" size={48} />
      </div>
    )
  }

  const unlockedCount = myBadges.length
  const totalBadges = BADGE_DEFINITIONS.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <ArrowLeft className="text-white" size={24} />
          </button>
          <h1 className="text-3xl font-bold text-white">🏆 Badges & Réalisations</h1>
        </div>

        {/* Stats personnelles */}
        <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl p-8 text-center mb-8">
          <Award className="mx-auto mb-4 text-yellow-400" size={64} />
          <h2 className="text-3xl font-bold text-white mb-2">{userName}</h2>
          <p className="text-gray-400 mb-4">Vos réalisations</p>
          <div className="flex justify-center gap-8">
            <div>
              <p className="text-4xl font-bold text-yellow-400">{unlockedCount}</p>
              <p className="text-gray-400 text-sm">Badge{unlockedCount > 1 ? 's' : ''} débloqué{unlockedCount > 1 ? 's' : ''}</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-500">{totalBadges - unlockedCount}</p>
              <p className="text-gray-400 text-sm">Badge{(totalBadges - unlockedCount) > 1 ? 's' : ''} à débloquer</p>
            </div>
          </div>
        </div>

        {/* Liste de tous les badges */}
        <div className="space-y-4">
          {BADGE_DEFINITIONS.map((badge) => {
            const Icon = badge.icon
            const earned = hasBadge(badge.id)
            const holders = getBadgeHolders(badge.id)
            const isExpanded = expandedBadge === badge.id

            return (
              <div
                key={badge.id}
                className={`rounded-2xl overflow-hidden transition-all ${
                  earned
                    ? `bg-gradient-to-br ${badge.color} p-1`
                    : 'bg-slate-800/30 border border-gray-700/50'
                }`}
              >
                <div className={`${earned ? 'bg-slate-900' : 'bg-slate-800/50'} rounded-xl p-6`}>
                  <div className="flex items-start gap-6">
                    {/* Icône */}
                    <div className={`flex-shrink-0 ${earned ? '' : 'opacity-40'}`}>
                      <Icon 
                        className={earned ? 'text-white' : 'text-gray-600'} 
                        size={64} 
                      />
                    </div>

                    {/* Contenu */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className={`text-2xl font-bold ${earned ? 'text-white' : 'text-gray-500'}`}>
                              {badge.name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              earned
                                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                : 'bg-gray-700/50 text-gray-400 border border-gray-600/30'
                            }`}>
                              {earned ? '✅ Débloqué' : '🔒 Verrouillé'}
                            </span>
                          </div>
                          <p className={`text-lg mb-2 ${earned ? 'text-gray-300' : 'text-gray-600'}`}>
                            {badge.description}
                          </p>
                          <p className={`text-sm ${earned ? 'text-gray-400' : 'text-gray-600'}`}>
                            <strong>Comment l'obtenir :</strong> {badge.criteria}
                          </p>
                        </div>
                      </div>

                      {/* Vue manager : qui possède ce badge */}
                      {isManager && holders.length > 0 && (
                        <div className="mt-4">
                          <button
                            onClick={() => toggleBadgeExpansion(badge.id)}
                            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition text-sm font-semibold"
                          >
                            <Users size={16} />
                            {holders.length} joueur{holders.length > 1 ? 's' : ''} possède{holders.length > 1 ? 'nt' : ''} ce badge
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>

                          {isExpanded && (
                            <div className="mt-3 bg-slate-700/30 rounded-lg p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {holders.map(holder => (
                                  <div 
                                    key={holder.id}
                                    className="flex items-center gap-2 bg-slate-600/30 rounded-lg p-2"
                                  >
                                    <Award className="text-yellow-400" size={16} />
                                    <div>
                                      <p className="text-white text-sm font-semibold">
                                        {holder.player_name}
                                        {holder.user_id === currentUserId && ' (Vous)'}
                                      </p>
                                      <p className="text-gray-400 text-xs">
                                        {new Date(holder.earned_at).toLocaleDateString('fr-FR')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Message si aucun badge */}
        {unlockedCount === 0 && (
          <div className="mt-8 bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
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