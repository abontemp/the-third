'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, Check, X, Loader, Mail, Clock } from 'lucide-react'

interface PendingRequest {
  id: string
  user_id: string
  joined_at: string
  user_name: string
  user_email: string
}

export default function TeamRequestsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState('')

  useEffect(() => {
    loadRequests()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequests = async () => {
    try {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer l'équipe sélectionnée
      const savedTeamId = localStorage.getItem('selectedTeamId')
      if (!savedTeamId) {
        alert('Aucune équipe sélectionnée')
        router.push('/dashboard')
        return
      }

      setTeamId(savedTeamId)

      // Vérifier que l'utilisateur est manager ou créateur
      const { data: membership } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', savedTeamId)
        .eq('user_id', user.id)
        .single()

      if (!membership || (membership.role !== 'creator' && membership.role !== 'manager')) {
        alert('Accès refusé : vous devez être manager')
        router.push('/dashboard')
        return
      }

      // Charger les infos de l'équipe
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', savedTeamId)
        .single()

      if (teamData) {
        setTeamName(teamData.name)
      }

      // Charger les demandes en attente
      const { data: pendingRequests } = await supabase
        .from('team_members')
        .select('id, user_id, joined_at')
        .eq('team_id', savedTeamId)
        .eq('status', 'pending')
        .order('joined_at', { ascending: false })

      if (pendingRequests && pendingRequests.length > 0) {
        // Charger les profils des demandeurs
        const userIds = pendingRequests.map(r => r.user_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, nickname')
          .in('id', userIds)

        const profilesMap: Record<string, any> = {}
        profiles?.forEach(p => {
          profilesMap[p.id] = p
        })

        const formattedRequests = pendingRequests.map(req => {
          const profile = profilesMap[req.user_id]
          let displayName = 'Utilisateur inconnu'

          if (profile) {
            if (profile.nickname?.trim()) {
              displayName = profile.nickname.trim()
            } else if (profile.first_name || profile.last_name) {
              const firstName = profile.first_name?.trim() || ''
              const lastName = profile.last_name?.trim() || ''
              displayName = `${firstName} ${lastName}`.trim()
            } else if (profile.email) {
              displayName = profile.email
            }
          }

          return {
            id: req.id,
            user_id: req.user_id,
            joined_at: req.joined_at,
            user_name: displayName,
            user_email: profile?.email || 'Email inconnu'
          }
        })

        setRequests(formattedRequests)
      }

      setLoading(false)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors du chargement des demandes')
      setLoading(false)
    }
  }

  const handleRequest = async (requestId: string, userId: string, userName: string, action: 'accept' | 'reject') => {
    if (!teamId) return

    try {
      setProcessing(requestId)

      if (action === 'accept') {
        // Accepter la demande
        const { error: updateError } = await supabase
          .from('team_members')
          .update({ status: 'accepted' })
          .eq('id', requestId)

        if (updateError) throw updateError

        // Créer une notification pour l'utilisateur
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'team_join_accepted',
            title: '✅ Demande acceptée',
            message: `Votre demande pour rejoindre l'équipe "${teamName}" a été acceptée !`,
            team_id: teamId,
            team_member_id: requestId
          })

        alert(`${userName} a été accepté dans l'équipe !`)
      } else {
        // Refuser la demande (supprimer le membre ou marquer comme rejected)
        const { error: deleteError } = await supabase
          .from('team_members')
          .delete()
          .eq('id', requestId)

        if (deleteError) throw deleteError

        // Créer une notification pour l'utilisateur
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'team_join_rejected',
            title: '❌ Demande refusée',
            message: `Votre demande pour rejoindre l'équipe "${teamName}" a été refusée.`,
            team_id: teamId
          })

        alert(`La demande de ${userName} a été refusée`)
      }

      // Recharger les demandes
      await loadRequests()
    } catch (error) {
      console.error('Erreur:', error)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition mb-4"
          >
            ← Retour au dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">Demandes d'adhésion</h1>
          <p className="text-gray-400">{teamName}</p>
        </div>

        {requests.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-12 text-center">
            <Users className="text-gray-400 mx-auto mb-4" size={64} />
            <h2 className="text-2xl font-bold text-white mb-2">Aucune demande en attente</h2>
            <p className="text-gray-400">Les nouvelles demandes apparaîtront ici</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {request.user_name[0].toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">{request.user_name}</h3>
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                          <Mail size={14} />
                          <span>{request.user_email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm mt-3">
                      <Clock size={14} />
                      <span>
                        Demande envoyée le {new Date(request.joined_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRequest(request.id, request.user_id, request.user_name, 'accept')}
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
                      onClick={() => handleRequest(request.id, request.user_id, request.user_name, 'reject')}
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