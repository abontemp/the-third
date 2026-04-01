'use client'
import { logger } from '@/lib/utils/logger'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { ArrowLeft, Loader, UserPlus, Check, X, Users } from 'lucide-react'

type JoinRequest = {
  id: string
  user_id: string
  user_name: string
  user_email: string
  created_at: string
}

function RequestsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string>('')

  useEffect(() => {
    loadRequests()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequests = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        logger.log('❌ Pas d\'utilisateur')
        router.push('/login')
        return
      }

      logger.log('👤 User ID:', user.id)

      // Récupérer le team_id depuis l'URL
      let teamIdToUse = searchParams.get('team_id')
      logger.log('🔗 Team ID depuis URL:', teamIdToUse)

      if (!teamIdToUse) {
        // Fallback localStorage
        teamIdToUse = localStorage.getItem('current_team_id')
        logger.log('📦 Team ID depuis localStorage:', teamIdToUse)
      }

      if (!teamIdToUse) {
        logger.log('⚠️ Pas de team_id, récupération depuis DB...')
        
        const { data: memberships } = await supabase
          .from('team_members')
          .select('team_id, role')
          .eq('user_id', user.id)

        logger.log('📋 Memberships trouvés:', memberships)

        if (!memberships || memberships.length === 0) {
          alert('Vous n\'êtes membre d\'aucune équipe')
          router.push('/dashboard')
          return
        }

        const managerMembership = memberships.find(m => m.role === 'manager' || m.role === 'creator')

        if (!managerMembership) {
          alert('Vous devez être manager pour accéder à cette page')
          router.push('/dashboard')
          return
        }

        teamIdToUse = managerMembership.team_id
        logger.log('✅ Team ID récupéré depuis DB:', teamIdToUse)
      }

      const finalTeamId: string = teamIdToUse ?? ''

      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('team_id', finalTeamId)
        .single()

      if (!membership || !['manager', 'creator'].includes(membership.role)) {
        alert('Vous devez être manager de cette équipe')
        router.push('/dashboard')
        return
      }

      logger.log('✅ Team ID à utiliser:', finalTeamId)
      logger.log('✅ Rôle:', membership.role)
      setTeamId(finalTeamId)

      logger.log('🔍 Recherche des demandes pour team:', finalTeamId)
      
      const { data: requestsData, error: requestsError } = await supabase
        .from('join_requests')
        .select('id, user_id, created_at')
        .eq('team_id', finalTeamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      logger.log('📨 Demandes trouvées:', requestsData?.length || 0)
      logger.log('📋 Détails:', requestsData)

      if (requestsError) {
        logger.error('❌ Erreur demandes:', requestsError)
        throw requestsError
      }

      if (!requestsData || requestsData.length === 0) {
        logger.log('ℹ️ Aucune demande en attente')
        setRequests([])
        setLoading(false)
        return
      }

      const userIds = requestsData.map(r => r.user_id)
      logger.log('👥 User IDs à rechercher:', userIds)
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, nickname, email')
        .in('id', userIds)

      logger.log('👤 Profils trouvés:', profilesData?.length || 0)
      if (profilesError) logger.error('⚠️ Erreur profils:', profilesError)

      const profilesMap: Record<string, { name: string, email: string }> = {}
      profilesData?.forEach(p => {
        let displayName = 'Utilisateur'
        if (p.nickname?.trim()) {
          displayName = p.nickname.trim()
        } else if (p.first_name || p.last_name) {
          const firstName = p.first_name?.trim() || ''
          const lastName = p.last_name?.trim() || ''
          displayName = `${firstName} ${lastName}`.trim()
        }
        
        profilesMap[p.id] = {
          name: displayName,
          email: p.email || 'Email inconnu'
        }
      })

      logger.log('🗺️ Profiles map:', profilesMap)

      const formattedRequests: JoinRequest[] = requestsData.map(r => ({
        id: r.id,
        user_id: r.user_id,
        user_name: profilesMap[r.user_id]?.name || 'Utilisateur',
        user_email: profilesMap[r.user_id]?.email || 'Email inconnu',
        created_at: r.created_at
      }))

      logger.log('✅ Demandes formatées:', formattedRequests)

      setRequests(formattedRequests)

    } catch (err) {
      logger.error('Erreur:', err)
      alert('Erreur lors du chargement des demandes')
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async (requestId: string, userId: string, action: 'accept' | 'reject') => {
    try {
      setProcessing(requestId)

      if (action === 'accept') {
        // Vérifier si l'utilisateur est déjà membre
        const { data: existingMember } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', teamId)
          .eq('user_id', userId)
          .single()

        if (existingMember) {
          logger.log('⚠️ Utilisateur déjà membre, on passe juste au statut approved')
        } else {
          // Ajouter le membre seulement s'il n'existe pas
          const { error: memberError } = await supabase
            .from('team_members')
            .insert([{
              team_id: teamId,
              user_id: userId,
              role: 'member'
            }])

          if (memberError) throw memberError
        }
      }

      const { error: updateError } = await supabase
        .from('join_requests')
        .update({ status: action === 'accept' ? 'accepted' : 'rejected' })
        .eq('id', requestId)

      if (updateError) throw updateError

      const { error: notifError } = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          type: action === 'accept' ? 'team_join_accepted' : 'team_join_rejected',
          title: action === 'accept' ? 'Demande acceptée !' : 'Demande refusée',
          message: action === 'accept' 
            ? 'Votre demande d\'adhésion a été acceptée. Bienvenue dans l\'équipe !' 
            : 'Votre demande d\'adhésion a été refusée.',
          team_id: teamId,
          read: false
        }])

      if (notifError) logger.error('Erreur notification:', notifError)

      alert(action === 'accept' ? '✅ Membre ajouté !' : '❌ Demande refusée')

      await loadRequests()

    } catch (err) {
      logger.error('Erreur:', err)
      alert('Erreur lors du traitement de la demande')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    )
  }

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
              <UserPlus size={24} />
              Demandes d&apos;adhésion
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {requests.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Users className="text-gray-600 mx-auto mb-4" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Aucune demande en attente</h2>
            <p className="text-gray-400">
              Les nouvelles demandes d&apos;adhésion apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-orange-900/30 to-red-900/30 border border-orange-500/30 rounded-xl p-4 mb-6">
              <p className="text-white font-semibold">
                {requests.length} demande{requests.length > 1 ? 's' : ''} en attente
              </p>
            </div>

            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {request.user_name[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{request.user_name}</h3>
                        <p className="text-gray-400 text-sm">{request.user_email}</p>
                      </div>
                    </div>
                    <p className="text-gray-500 text-sm">
                      Demande envoyée le {new Date(request.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRequest(request.id, request.user_id, 'accept')}
                      disabled={processing === request.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
                    >
                      {processing === request.id ? (
                        <Loader className="animate-spin" size={18} />
                      ) : (
                        <Check size={18} />
                      )}
                      <span>Accepter</span>
                    </button>
                    <button
                      onClick={() => handleRequest(request.id, request.user_id, 'reject')}
                      disabled={processing === request.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
                    >
                      {processing === request.id ? (
                        <Loader className="animate-spin" size={18} />
                      ) : (
                        <X size={18} />
                      )}
                      <span>Refuser</span>
                    </button>
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

export default function RequestsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <Loader className="text-white animate-spin" size={48} />
      </div>
    }>
      <RequestsContent />
    </Suspense>
  )
}