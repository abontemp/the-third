'use client'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Camera, Loader, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function PlayerProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string>('')
  
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    nickname: '',
    player_number: '',
    avatar_url: ''
  })
  
  const [previewUrl, setPreviewUrl] = useState<string>('')

  useEffect(() => {
    loadProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = async () => {
    try {
      setLoading(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUserId(user.id)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile({
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          email: profileData.email || '',
          nickname: profileData.nickname || '',
          player_number: profileData.player_number?.toString() || '',
          avatar_url: profileData.avatar_url || ''
        })
        
        if (profileData.avatar_url) {
          setPreviewUrl(profileData.avatar_url)
        }
      }
    } catch (err) {
      console.error('Erreur:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // Créer une preview locale
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)

      // Upload vers Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Math.random()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('player-avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Récupérer l'URL publique
      const { data: urlData } = supabase.storage
        .from('player-avatars')
        .getPublicUrl(filePath)

      setProfile({ ...profile, avatar_url: urlData.publicUrl })
      
    } catch (err) {
      console.error('Erreur upload:', err)
      alert('Erreur lors de l\'upload de l\'image')
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          nickname: profile.nickname || null,
          player_number: profile.player_number ? parseInt(profile.player_number) : null,
          avatar_url: profile.avatar_url || null
        })
        .eq('id', userId)

      if (error) throw error

      alert('Profil mis à jour avec succès !')
      router.push('/dashboard')
      
    } catch (err) {
      console.error('Erreur:', err)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
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
            <h1 className="text-xl font-bold text-white">Mon Profil</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-8">
          
          {/* Photo de profil */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-4xl font-bold">
                    {profile.first_name ? profile.first_name[0].toUpperCase() : '?'}
                  </span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer transition">
                <Camera size={20} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-gray-400 text-sm mt-2">Cliquez pour changer la photo</p>
          </div>

          {/* Formulaire */}
          <div className="space-y-4">
            {/* Prénom */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prénom
              </label>
              <input
                type="text"
                value={profile.first_name}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                placeholder="Jean"
              />
            </div>

            {/* Nom */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nom
              </label>
              <input
                type="text"
                value={profile.last_name}
                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                placeholder="Dupont"
              />
            </div>

            {/* Surnom */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Surnom <span className="text-gray-500">(optionnel)</span>
              </label>
              <input
                type="text"
                value={profile.nickname}
                onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                placeholder="Le Tigre"
              />
              <p className="text-gray-500 text-xs mt-1">
                Ce surnom sera utilisé dans les votes et classements
              </p>
            </div>

            {/* Numéro */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Numéro de maillot <span className="text-gray-500">(optionnel)</span>
              </label>
              <input
                type="number"
                value={profile.player_number}
                onChange={(e) => setProfile({ ...profile, player_number: e.target.value })}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                placeholder="10"
                min="0"
                max="99"
              />
            </div>

            {/* Email (lecture seule) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full bg-slate-700/30 border border-white/10 rounded-lg px-4 py-3 text-gray-500 cursor-not-allowed"
              />
              <p className="text-gray-500 text-xs mt-1">
                L&apos;email ne peut pas être modifié ici
              </p>
            </div>
          </div>

          {/* Bouton de sauvegarde */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader className="animate-spin" size={20} />
                Sauvegarde...
              </>
            ) : (
              <>
                <Save size={20} />
                Enregistrer les modifications
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}