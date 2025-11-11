'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Check, X, Loader, Users, Clock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

type JoinRequest = {
  id: string
  user_id: string
  created_at: string
  user_name: string
  user_email: string
}

export default function TeamRequestsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string>('')
  const [teamName, setTeamName] = useState<string>('')
  const [requests, setRequests] = useState<JoinRequest[]>([])

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    try {
      setLoading(true)
      
      // Vérifier l'authentification
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Récupérer le team_id depuis localStorage
      const savedTeamId = localStorage.getItem('current_team_id')
      if (!savedTeamId) {
        alert('Aucune équipe sélectionnée')
        router.push('/dashboard')
        return
      }

      // Vérifier que l'utilisateur est manager ou creator
      const { data: membershipData } = await supabase
        .from('team_members')
        .select('role, team_id')
        .eq('user_id', user.id)
        .eq('team_id', savedTeamId)
        .single()

      if (!membershipData || !['manager', 'creator'].includes(membershipData.role)) {
        alert('Accès refusé : vous devez être manager ou créateur de l\'équipe')
        router.push('/dashboard')
        return
      }

      setTeamId(savedTeamId)

      // Récupérer le nom de l'équipe
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('id', savedTeamId)
        .single()

      if (teamData) {
        setTeamName(teamData.name)
      }

      // Récupérer les demandes en attente avec les infos des utilisateurs
      const { data: requestsData, error: requestsError } = await supabase
        .from('join_requests')
        .select(`
          id,
          user_id,
          created_at,
          profiles:user_id (
            first_name,
            last_name,
            email,
            nickname
          )
        `)
        .eq('team_id', savedTeamId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (requestsError) throw requestsError

      // Formater les données
      const formattedRequests = requestsData?.map(req => ({
        id: req.id,
        user_id: req.user_id,
        created_at: req.created_at,
        user_name: req.profiles?.nickname || 
                   `${req.profiles?.first_name || ''} ${req.profiles?.last_name || ''}`.trim() ||
                   'Utilisateur inconnu',
        user_email: req.profiles?.email || ''
      })) || []

      setRequests(formattedRequests)
    } catch (error) {
      console.error('Erreur lors du chargement des demandes:', error)
      alert('Erreur lors du chargement des demandes')
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async (requestId: string, userId: string, userName: string, accept: boolean) => {
    try {
      setProcessing(requestId)

      if (accept) {
        // Accepter : mettre à jour le statut de la demande
        const { error: updateError } = await supabase
          .from('join_requests')
          .update({ status: 'accepted' })
          .eq('id', requestId)

        if (updateError) throw updateError

        // Ajouter le membre à l'équipe
        const { error: memberError } = await supabase
          .from('team_members')
          .insert({
            team_id: teamId,
            user_id: userId,
            role: 'member'
          })

        if (memberError) throw memberError

        // Créer une notification pour l'utilisateur
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'team_join_accepted',
            title: '✅ Demande acceptée',
            message: `Votre demande pour rejoindre l'équipe "${teamName}" a été acceptée !`,
            team_id: teamId
          })

        alert(`${userName} a été accepté dans l'équipe !`)
      } else {
        // Refuser : mettre à jour le statut
        const { error: updateError } = await supabase
          .from('join_requests')
          .update({ status: 'rejected' })
          .eq('id', requestId)

        if (updateError) throw updateError

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Il y a moins d\'une heure'
    if (diffInHours < 24) return `Il y a ${diffInHours} heure${diffInHours > 1 ? 's' : ''}`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`
    
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
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
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-gray-400 hover:text-white transition mb-4 flex items-center gap-2"
          >
            <ArrowLeft size={20} />
            Retour au dashboard
          </button>
          <h1 className="text-4xl font-bold text-white mb-2">Demandes d'adhésion</h1>
          <p className="text-gray-400">{teamName}</p>
        </div>

        {/* Liste des demandes */}
        {requests.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-12 text-center">
            <Users className="mx-auto mb-4 text-gray-400" size={64} />
            <h3 className="text-xl font-semibold text-white mb-2">
              Aucune demande en attente
            </h3>
            <p className="text-gray-400">
              Les nouvelles demandes d'adhésion apparaîtront ici
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="bg-white/10 backdrop-blur-md rounded-xl p-6 hover:bg-white/15 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-1">
                      {request.user_name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-2">{request.user_email}</p>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Clock size={16} />
                      <span>{formatDate(request.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleRequest(request.id, request.user_id, request.user_name, false)}
                      disabled={processing === request.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
                    >
                      {processing === request.id ? (
                        <Loader className="animate-spin" size={20} />
                      ) : (
                        <X size={20} />
                      )}
                      Refuser
                    </button>
                    <button
                      onClick={() => handleRequest(request.id, request.user_id, request.user_name, true)}
                      disabled={processing === request.id}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2"
                    >
                      {processing === request.id ? (
                        <Loader className="animate-spin" size={20} />
                      ) : (
                        <Check size={20} />
                      )}
                      Accepter
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