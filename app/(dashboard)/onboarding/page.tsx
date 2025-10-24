'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Loader, LogIn, UserPlus } from 'lucide-react'

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice')
  
  // États pour créer une équipe
  const [teamName, setTeamName] = useState('')
  const [teamSport, setTeamSport] = useState('')
  const [teamDescription, setTeamDescription] = useState('')
  
  // États pour rejoindre une équipe
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    checkAuth()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      // Vérifier si l'utilisateur a déjà des équipes
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)

      // Si l'utilisateur a au moins une équipe acceptée, rediriger vers le dashboard
      if (memberships && memberships.length > 0) {
        router.push('/dashboard')
        return
      }

      setLoading(false)
    } catch (error) {
      console.error('Erreur:', error)
      setLoading(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !teamSport.trim()) {
      alert('Veuillez remplir le nom et le sport de l&apos;équipe')
      return
    }

    try {
      setCreating(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Générer un code d'invitation unique
      const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase()

      // Créer l'équipe
      const { data: newTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          sport: teamSport.trim(),
          description: teamDescription.trim() || null,
          invite_code: inviteCode,
          created_by: user.id
        })
        .select()
        .single()

      if (teamError) throw teamError

      // Ajouter le créateur comme membre avec le rôle 'creator' et status 'accepted'
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({
          team_id: newTeam.id,
          user_id: user.id,
          role: 'creator',
          status: 'accepted'
        })

      if (memberError) throw memberError

      // Créer une saison par défaut
      await supabase
        .from('seasons')
        .insert({
          team_id: newTeam.id,
          name: 'Saison 2024-2025',
          start_date: new Date().toISOString().split('T')[0],
          is_active: true
        })

      alert(`Équipe créée avec succès !\nCode d'invitation : ${inviteCode}\nPartagez ce code avec vos coéquipiers.`)
      router.push('/dashboard')
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la création de l&apos;équipe')
    } finally {
      setCreating(false)
    }
  }

  const handleJoinTeam = async () => {
    if (!inviteCode.trim()) {
      alert('Veuillez entrer un code d\'invitation')
      return
    }

    try {
      setJoining(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Vérifier si l'équipe existe
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single()

      if (teamError || !team) {
        alert('Code d&apos;invitation invalide')
        setJoining(false)
        return
      }

      // Vérifier si l'utilisateur n'est pas déjà membre ou n'a pas déjà une demande
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id, status')
        .eq('team_id', team.id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingMember) {
        if (existingMember.status === 'pending') {
          alert('Vous avez déjà une demande en attente pour cette équipe. Les managers vont l&apos;examiner bientôt.')
        } else if (existingMember.status === 'accepted') {
          alert('Vous êtes déjà membre de cette équipe')
          router.push('/dashboard')
        } else if (existingMember.status === 'rejected') {
          alert('Votre demande précédente a été refusée. Contactez un manager pour plus d&apos;informations.')
        }
        setJoining(false)
        return
      }

      // Créer une demande d'adhésion (status: 'pending')
      const { error: insertError } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: user.id,
          role: 'member',
          status: 'pending'
        })

      if (insertError) throw insertError

      // Récupérer les managers de l'équipe
      const { data: managers } = await supabase
        .from('team_members')
        .select('user_id')
        .eq('team_id', team.id)
        .in('role', ['creator', 'manager'])
        .eq('status', 'accepted')

      // Récupérer le nom de l'utilisateur
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, nickname, email')
        .eq('id', user.id)
        .single()

      let userName = 'Un utilisateur'
      if (profile) {
        if (profile.nickname?.trim()) {
          userName = profile.nickname.trim()
        } else if (profile.first_name || profile.last_name) {
          const firstName = profile.first_name?.trim() || ''
          const lastName = profile.last_name?.trim() || ''
          userName = `${firstName} ${lastName}`.trim()
        } else if (profile.email) {
          userName = profile.email
        }
      }

      // Créer une notification pour chaque manager
      if (managers && managers.length > 0) {
        const notifications = managers.map(manager => ({
          user_id: manager.user_id,
          type: 'team_join_request',
          title: '🔔 Nouvelle demande',
          message: `${userName} souhaite rejoindre l'équipe "${team.name}"`,
          team_id: team.id
        }))

        await supabase
          .from('notifications')
          .insert(notifications)
      }

      alert(`Demande envoyée avec succès !\n\nLes managers de "${team.name}" vont examiner votre demande et vous recevrez une notification dès qu&apos;une décision sera prise.`)
      
      // Rediriger vers le dashboard (ils verront un message en attente)
      router.push('/dashboard')
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de l\'envoi de la demande')
    } finally {
      setJoining(false)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {mode === 'choice' && (
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-orange-500 rounded-2xl flex items-center justify-center font-bold text-white text-2xl mx-auto mb-4">
              T3
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Bienvenue sur Top3</h1>
            <p className="text-gray-400 text-lg">Créez ou rejoignez une équipe pour commencer</p>
          </div>
        )}

        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
          {mode === 'choice' && (
            <div className="space-y-4">
              <button
                onClick={() => setMode('create')}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition shadow-lg"
              >
                <Plus size={24} />
                <span>Créer une nouvelle équipe</span>
              </button>

              <button
                onClick={() => setMode('join')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition border border-white/10"
              >
                <UserPlus size={24} />
                <span>Rejoindre une équipe existante</span>
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div>
              <button
                onClick={() => setMode('choice')}
                className="text-gray-400 hover:text-white transition mb-6"
              >
                ← Retour
              </button>

              <h2 className="text-2xl font-bold text-white mb-6">Créer votre équipe</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Nom de l'équipe *
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Ex: Les Tigres"
                    className="w-full bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Sport *
                  </label>
                  <select
                    value={teamSport}
                    onChange={(e) => setTeamSport(e.target.value)}
                    className="w-full bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">-- Sélectionnez un sport --</option>
                    <option value="Football">Football ⚽</option>
                    <option value="Basketball">Basketball 🏀</option>
                    <option value="Volleyball">Volleyball 🏐</option>
                    <option value="Handball">Handball 🤾</option>
                    <option value="Rugby">Rugby 🏉</option>
                    <option value="Hockey">Hockey 🏒</option>
                    <option value="Tennis">Tennis 🎾</option>
                    <option value="Baseball">Baseball ⚾</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Description (optionnel)
                  </label>
                  <textarea
                    value={teamDescription}
                    onChange={(e) => setTeamDescription(e.target.value)}
                    placeholder="Décrivez votre équipe..."
                    rows={3}
                    className="w-full bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <button
                  onClick={handleCreateTeam}
                  disabled={creating || !teamName.trim() || !teamSport.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg"
                >
                  {creating ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      <span>Création en cours...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={20} />
                      <span>Créer l'équipe</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === 'join' && (
            <div>
              <button
                onClick={() => setMode('choice')}
                className="text-gray-400 hover:text-white transition mb-6"
              >
                ← Retour
              </button>

              <h2 className="text-2xl font-bold text-white mb-6">Rejoindre une équipe</h2>

              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-blue-200 text-sm">
                  💡 <strong>Comment ça marche ?</strong>
                  <br />
                  1. Entrez le code d'invitation fourni par un manager
                  <br />
                  2. Votre demande sera envoyée aux managers
                  <br />
                  3. Vous recevrez une notification dès qu'ils auront pris une décision
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Code d'invitation
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="Ex: ABC123XY"
                    className="w-full bg-slate-700 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-mono text-lg tracking-wider"
                    maxLength={8}
                  />
                </div>

                <button
                  onClick={handleJoinTeam}
                  disabled={joining || !inviteCode.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white py-4 rounded-lg font-bold text-lg flex items-center justify-center gap-2 transition shadow-lg"
                >
                  {joining ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      <span>Envoi de la demande...</span>
                    </>
                  ) : (
                    <>
                      <LogIn size={20} />
                      <span>Envoyer la demande</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}