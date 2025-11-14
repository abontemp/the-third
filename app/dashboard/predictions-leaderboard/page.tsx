'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader, Sparkles, Trophy } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

type Predictor = {
  player_id: string
  player_name: string
  correct_predictions: number
  total_predictions: number
  accuracy: number
}

function PredictionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [predictors, setPredictors] = useState<Predictor[]>([])

  useEffect(() => {
    loadPredictions()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPredictions = async () => {
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
        setPredictors([])
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

      // Statistiques simulées (à remplacer par vraie logique)
      const mockPredictors: Predictor[] = members.map(m => {
        const total = Math.floor(Math.random() * 20) + 5
        const correct = Math.floor(Math.random() * total)
        return {
          player_id: m.user_id,
          player_name: profilesMap[m.user_id] || 'Inconnu',
          correct_predictions: correct,
          total_predictions: total,
          accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
        }
      }).sort((a, b) => b.accuracy - a.accuracy)

      setPredictors(mockPredictors)

    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900">
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
              <Sparkles size={24} />
              Classement des Pronostiqueurs
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        <h2 className="text-2xl font-bold text-white mb-6">Meilleurs pronostiqueurs</h2>

        {predictors.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Sparkles className="mx-auto mb-4 text-gray-600" size={64} />
            <p className="text-gray-400">Aucune prédiction disponible</p>
          </div>
        ) : (
          <div className="space-y-3">
            {predictors.map((predictor, index) => (
              <div 
                key={predictor.player_id}
                className={`bg-gradient-to-br ${
                  index === 0 ? 'from-yellow-900/30 to-orange-900/30 border-yellow-500/30' :
                  'from-slate-800/30 to-slate-900/30 border-white/10'
                } border rounded-xl p-6`}
              >
                <div className="flex items-center gap-4">
                  {index < 3 && (
                    <Trophy className={`${
                      index === 0 ? 'text-yellow-400' :
                      index === 1 ? 'text-gray-300' :
                      'text-orange-600'
                    }`} size={32} />
                  )}
                  
                  <div className="text-2xl font-bold text-gray-500">
                    #{index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{predictor.player_name}</h3>
                    <p className="text-sm text-gray-400">
                      {predictor.correct_predictions} / {predictor.total_predictions} prédictions correctes
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`text-3xl font-bold ${
                      predictor.accuracy >= 70 ? 'text-green-400' :
                      predictor.accuracy >= 50 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {predictor.accuracy}%
                    </p>
                    <p className="text-sm text-gray-400">précision</p>
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

export default function PredictionsLeaderboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-pink-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    }>
      <PredictionsContent />
    </Suspense>
  )
}