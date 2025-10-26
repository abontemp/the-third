'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Swords, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type RivalryPlayer = {
  user_id: string
  player_name: string
  count: number
}

export default function RivalriesPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [myRivals, setMyRivals] = useState<RivalryPlayer[]>([])
  const [mySupporters, setMySupporters] = useState<RivalryPlayer[]>([])
  const [topRivalries, setTopRivalries] = useState<Array<{player1: string, player2: string, count: number}>>([])
  const [userName, setUserName] = useState('')

  useEffect(() => {
    loadRivalries()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRivalries = async () => {
    try {
      console.log('🔍 Chargement des rivalités...')
      setLoading(true)
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('❌ Erreur auth:', userError)
        router.push('/login')
        return
      }

      console.log('✅ Utilisateur trouvé:', user.id)

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

      const { data: membership, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .single()

      if (membershipError || !membership) {
        console.error('⚠️ Erreur membership:', membershipError)
        setLoading(false)
        return
      }

      console.log('✅ Équipe trouvée:', membership.team_id)

      // Mes rivaux (qui me vote FLOP)
      const { data: rivalsData, error: rivalsError } = await supabase
        .from('votes')
        .select('user_id, voting_sessions!inner(match_id)')
        .eq('flop_player_id', user.id)
        .eq('voting_sessions.matches.seasons.team_id', membership.team_id)

      if (rivalsError) {
        console.error('⚠️ Erreur rivals:', rivalsError)
      } else {
        console.log('✅ Rivaux récupérés:', rivalsData?.length || 0)
      }

      // Mes supporters (qui me vote TOP)
      const { data: supportersData, error: supportersError } = await supabase
        .from('votes')
        .select('user_id, voting_sessions!inner(match_id)')
        .eq('top_player_id', user.id)
        .eq('voting_sessions.matches.seasons.team_id', membership.team_id)

      if (supportersError) {
        console.error('⚠️ Erreur supporters:', supportersError)
      } else {
        console.log('✅ Supporters récupérés:', supportersData?.length || 0)
      }

      // Compter les occurrences
      const rivalsCounts: Record<string, number> = {}
      const supportersCounts: Record<string, number> = {}

      rivalsData?.forEach(v => {
        rivalsCounts[v.user_id] = (rivalsCounts[v.user_id] || 0) + 1
      })

      supportersData?.forEach(v => {
        supportersCounts[v.user_id] = (supportersCounts[v.user_id] || 0) + 1
      })

      // Récupérer les profils
      const allUserIds = [...Object.keys(rivalsCounts), ...Object.keys(supportersCounts)]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname')
        .in('id', allUserIds)

      const profilesMap: Record<string, string> = {}
      profilesData?.forEach(p => {
        profilesMap[p.id] = p.nickname || 
                           (p.first_name && p.last_name 
                             ? `${p.first_name} ${p.last_name}` 
                             : 'Joueur')
      })

      // Formater les données
      const formattedRivals = Object.entries(rivalsCounts)
        .map(([userId, count]) => ({
          user_id: userId,
          player_name: profilesMap[userId] || 'Inconnu',
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const formattedSupporters = Object.entries(supportersCounts)
        .map(([userId, count]) => ({
          user_id: userId,
          player_name: profilesMap[userId] || 'Inconnu',
          count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      setMyRivals(formattedRivals)
      setMySupporters(formattedSupporters)

      // Top rivalités de l'équipe (simplifié - à implémenter complètement si besoin)
      setTopRivalries([])

    } catch (err) {
      console.error('❌ Erreur générale:', err)
    } finally {
      setLoading(false)
      console.log('✅ Chargement terminé')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="text-white animate-spin mx-auto mb-4" size={48} />
          <p className="text-gray-400">Chargement des rivalités...</p>
        </div>
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
        
        {/* En-tête */}
        <div className="bg-gradient-to-br from-red-900/30 to-orange-900/30 border border-red-500/30 rounded-2xl p-8 mb-8 text-center">
          <Swords className="mx-auto mb-4 text-red-400" size={64} />
          <h2 className="text-3xl font-bold text-white mb-2">{userName}</h2>
          <p className="text-gray-400">Vos relations de jeu</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mes rivaux */}
          <div className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border border-red-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <TrendingDown className="text-red-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Mes Rivaux</h3>
                <p className="text-sm text-gray-400">Ils me votent souvent FLOP</p>
              </div>
            </div>

            {myRivals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun rival pour le moment</p>
                <p className="text-sm">Continuez à jouer !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRivals.map((rival, index) => (
                  <div 
                    key={rival.user_id}
                    className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                        #{index + 1}
                      </div>
                      <span className="text-white font-semibold">{rival.player_name}</span>
                    </div>
                    <div className="text-red-400 font-bold text-lg">
                      {rival.count} FLOP{rival.count > 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mes supporters */}
          <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-green-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <TrendingUp className="text-green-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Mes Supporters</h3>
                <p className="text-sm text-gray-400">Ils me votent souvent TOP</p>
              </div>
            </div>

            {mySupporters.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Aucun supporter pour le moment</p>
                <p className="text-sm">Continuez à jouer !</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mySupporters.map((supporter, index) => (
                  <div 
                    key={supporter.user_id}
                    className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                        #{index + 1}
                      </div>
                      <span className="text-white font-semibold">{supporter.player_name}</span>
                    </div>
                    <div className="text-green-400 font-bold text-lg">
                      {supporter.count} TOP{supporter.count > 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top rivalités de l'équipe */}
        {topRivalries.length > 0 && (
          <div className="mt-8 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-purple-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Users className="text-purple-400" size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Top Rivalités de l&apos;équipe</h3>
                <p className="text-sm text-gray-400">Les duels les plus intenses</p>
              </div>
            </div>

            <div className="space-y-3">
              {topRivalries.map((rivalry, index) => (
                <div 
                  key={`${rivalry.player1}-${rivalry.player2}`}
                  className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                      #{index + 1}
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <span className="font-semibold">{rivalry.player1}</span>
                      <Swords className="text-red-400" size={16} />
                      <span className="font-semibold">{rivalry.player2}</span>
                    </div>
                  </div>
                  <div className="text-purple-400 font-bold">
                    {rivalry.count} duels
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}