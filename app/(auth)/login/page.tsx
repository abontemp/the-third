'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'  // AJOUTE CETTE LIGNE
import Link from 'next/link'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'


export default function LoginPage() {
    const router = useRouter()  // AJOUTE CETTE LIGNE
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  // AJOUTEZ CE useEffect
 useEffect(() => {
  // Nettoyer TOUT le stockage Supabase
  const cleanAll = () => {
    // 1. Nettoyer localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        localStorage.removeItem(key)
      }
    })
    
    // 2. Nettoyer sessionStorage
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-')) {
        sessionStorage.removeItem(key)
      }
    })
    
    // 3. Nettoyer cookies
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.split('=')
      const trimmedName = name.trim()
      if (trimmedName.includes('supabase') || trimmedName.includes('sb-')) {
        // Supprimer pour tous les chemins possibles
        document.cookie = `${trimmedName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
        document.cookie = `${trimmedName}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname}`
      }
    })
  }
  
  cleanAll()
  console.log('✅ Tout le stockage Supabase a été nettoyé')
}, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
    setError('')
  }

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Veuillez remplir tous les champs obligatoires')
      return false
    }
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setLoading(true)
    setError('')
 //comment
    try {
      const supabase = createClient()
      
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })
        if (error) throw error
        
        // Vérifier si l'utilisateur a des équipes
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        const { data: memberships } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', currentUser?.id)
        
        if (memberships && memberships.length > 0) {
          // A des équipes, rediriger vers dashboard
          setSuccess('Connexion réussie ! Redirection...')
          setTimeout(() => {
  router.push('/dashboard')
  router.refresh()  // Force le rechargement des données
}, 1000)
        } else {
          // Pas d'équipe, rediriger vers onboarding
          setSuccess('Connexion réussie ! Redirection...')
          setTimeout(() => {
  router.push('/onboarding')
  router.refresh()
}, 1000)
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
            }
          }
        })
        if (error) throw error
        setSuccess('Compte créé ! Redirection...')
        
        // Nouveau compte = pas d'équipe, aller à onboarding
       setTimeout(() => {
  router.push('/onboarding')
  router.refresh()
}, 1500)
      }

    } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute top-8 left-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-orange-500 rounded-lg flex items-center justify-center font-bold text-white">
            T3
          </div>
          <span className="text-xl font-bold text-white">The Third</span>
        </Link>
      </div>

      <div className="w-full max-w-md">
        <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Bon retour !' : 'Rejoignez-nous'}
            </h1>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-red-400" size={20} />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle className="text-green-400" size={20} />
              <p className="text-green-300 text-sm">{success}</p>
            </div>
          )}

          <div className="space-y-5">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Prénom</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Nom</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                    placeholder="Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                placeholder="email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Confirmer</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg font-semibold hover:shadow-lg transition disabled:opacity-50"
            >
              {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : 'Créer mon compte')}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {isLogin ? "S'inscrire" : 'Se connecter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}