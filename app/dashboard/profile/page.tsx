'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ArrowLeft, Camera, Loader, Save } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    nickname: '',
    avatar_url: ''
  })
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

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

      const { data: profileData } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, nickname, avatar_url')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile({
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          email: profileData.email || '',
          nickname: profileData.nickname || '',
          avatar_url: profileData.avatar_url || ''
        })
      }

    } catch (err) {
      console.error('Erreur chargement profil:', err)
      alert('Erreur lors du chargement du profil')
    } finally {
      setLoading(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let avatarUrl = profile.avatar_url

      // Upload de l'image si une nouvelle image a été sélectionnée
      if (selectedFile) {
        setUploading(true)
        
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`
        const filePath = `avatars/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('player-avatars')
          .upload(filePath, selectedFile, { upsert: true })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('player-avatars')
          .getPublicUrl(filePath)

        avatarUrl = publicUrl
        setUploading(false)
      }

      // Mise à jour du profil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name.trim() || null,
          last_name: profile.last_name.trim() || null,
          nickname: profile.nickname.trim() || null,
          avatar_url: avatarUrl || null
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      alert('Profil mis à jour avec succès !')
      router.push('/dashboard')

    } catch (err) {
      console.error('Erreur sauvegarde:', err)
      alert('Erreur lors de la sauvegarde du profil')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Loader className="animate-spin text-purple-400" size={48} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-purple-300 hover:text-purple-100 mb-6 flex items-center gap-2 transition"
        >
          <ArrowLeft size={20} />
          Retour au dashboard
        </button>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Mon profil</h1>

          {/* Photo de profil */}
          <div className="mb-8 flex flex-col items-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white text-4xl font-bold">
                    {profile.first_name ? profile.first_name[0].toUpperCase() : profile.nickname ? profile.nickname[0].toUpperCase() : '?'}
                  </span>
                )}
              </div>
              <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full cursor-pointer transition">
                <Camera size={20} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
            <p className="text-gray-400 text-sm mt-2">Cliquez sur l&apos;icône pour changer la photo</p>
          </div>

          {/* Formulaire */}
          <div className="space-y-6">
            {/* Email (non modifiable) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full bg-slate-700/30 border border-white/10 rounded-lg px-4 py-3 text-gray-400 cursor-not-allowed"
              />
            </div>

            {/* Prénom */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prénom
              </label>
              <input
                type="text"
                value={profile.first_name}
                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Dupont"
              />
            </div>

            {/* Surnom */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Surnom <span className="text-purple-400">(optionnel)</span>
              </label>
              <input
                type="text"
                value={profile.nickname}
                onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                className="w-full bg-slate-700/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Le Tigre"
              />
              <p className="text-gray-400 text-sm mt-2">
                💡 Si vous définissez un surnom, il sera utilisé à la place de votre prénom/nom dans toute l&apos;application
              </p>
            </div>

            {/* Info sur l'affichage */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">Comment vous serez affiché :</h3>
              <p className="text-blue-300 text-lg font-bold">
                {profile.nickname.trim() ? 
                  profile.nickname.trim() : 
                  profile.first_name || profile.last_name ? 
                    `${profile.first_name} ${profile.last_name}`.trim() : 
                    profile.email || 'Non défini'}
              </p>
            </div>

            {/* Bouton de sauvegarde */}
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-4 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving || uploading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  <span>{uploading ? 'Upload en cours...' : 'Enregistrement...'}</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>Enregistrer les modifications</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}