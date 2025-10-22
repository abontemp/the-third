type Profile = {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  id?: string
}

export function getDisplayName(profile: Profile | null | undefined): string {
  if (!profile) return 'Utilisateur inconnu'
  
  // 1. Priorité au surnom
  if (profile.nickname?.trim()) {
    return profile.nickname.trim()
  }
  
  // 2. Sinon prénom + nom
  if (profile.first_name || profile.last_name) {
    const firstName = profile.first_name?.trim() || ''
    const lastName = profile.last_name?.trim() || ''
    const fullName = `${firstName} ${lastName}`.trim()
    if (fullName) return fullName
  }
  
  // 3. Sinon email
  if (profile.email) {
    return profile.email
  }
  
  // 4. Dernier recours : ID tronqué
  if (profile.id) {
    return `Membre #${profile.id.substring(0, 8)}`
  }
  
  return 'Utilisateur'
}