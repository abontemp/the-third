'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LayoutDashboard, User, Award, BarChart2, ChevronDown, Plus, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type TeamOption = {
  id: string
  name: string
}

const NAV_ITEMS = [
  { label: 'Accueil', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Profil',  icon: User,            href: '/dashboard/profile' },
  { label: 'Badges',  icon: Award,           href: '/dashboard/badges' },
  { label: 'Stats',   icon: BarChart2,        href: '/dashboard/stats' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router   = useRouter()

  const [showSheet,       setShowSheet]       = useState(false)
  const [teams,           setTeams]           = useState<TeamOption[]>([])
  const [currentTeamId,   setCurrentTeamId]   = useState('')
  const [currentInitial,  setCurrentInitial]  = useState('?')

  useEffect(() => {
    loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTeams = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, teams(id, name)')
        .eq('user_id', user.id)

      if (!memberships) return

      const teamOptions: TeamOption[] = memberships
        .map(m => {
          const t = Array.isArray(m.teams) ? m.teams[0] : m.teams
          return t as TeamOption
        })
        .filter(Boolean)

      setTeams(teamOptions)

      const savedId = localStorage.getItem('selectedTeamId') || ''
      setCurrentTeamId(savedId)
      const current = teamOptions.find(t => t.id === savedId)
      if (current) setCurrentInitial(current.name[0].toUpperCase())
    } catch { /* silently ignore */ }
  }

  const switchTeam = (team: TeamOption) => {
    localStorage.setItem('selectedTeamId', team.id)
    setCurrentTeamId(team.id)
    setCurrentInitial(team.name[0].toUpperCase())
    setShowSheet(false)
    // Force re-mount du dashboard pour charger la nouvelle équipe
    window.location.href = '/dashboard'
  }

  return (
    <>
      {/* Backdrop + sheet */}
      {showSheet && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 sm:hidden"
            onClick={() => setShowSheet(false)}
          />
          <div className="fixed bottom-[65px] left-0 right-0 z-50 sm:hidden bg-slate-800 border border-white/10 rounded-t-2xl shadow-2xl max-h-[60vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-lg">Mes équipes</h3>
                <button onClick={() => setShowSheet(false)} className="text-gray-400 p-1">
                  <ChevronDown size={20} />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                {teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => switchTeam(team)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition text-left ${
                      team.id === currentTeamId
                        ? 'bg-blue-600/20 border border-blue-500/40'
                        : 'bg-slate-700/50 border border-white/10 active:bg-slate-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      team.id === currentTeamId ? 'bg-blue-600 text-white' : 'bg-slate-600 text-gray-300'
                    }`}>
                      {team.name[0].toUpperCase()}
                    </div>
                    <span className="text-white font-medium flex-1 truncate">{team.name}</span>
                    {team.id === currentTeamId && <Check className="text-blue-400 shrink-0" size={18} />}
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setShowSheet(false); router.push('/dashboard/join-team') }}
                className="w-full flex items-center justify-center gap-2 bg-slate-700/50 border border-white/10 text-gray-300 py-3 rounded-xl font-medium transition active:bg-slate-700"
              >
                <Plus size={18} />
                Rejoindre une autre équipe
              </button>
            </div>
          </div>
        </>
      )}

      {/* Barre de navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-slate-900/95 backdrop-blur-sm border-t border-white/10"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
            const isActive =
              href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(href)
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                  isActive ? 'text-blue-400' : 'text-gray-500 active:text-gray-300'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-xs font-medium">{label}</span>
              </button>
            )
          })}

          {/* Équipe tab */}
          <button
            onClick={() => setShowSheet(s => !s)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
              showSheet ? 'text-blue-400' : 'text-gray-500 active:text-gray-300'
            }`}
          >
            <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-bold leading-none ${
              showSheet ? 'bg-blue-500 text-white' : 'bg-slate-700 text-gray-300'
            }`}>
              {currentInitial}
            </div>
            <span className="text-xs font-medium">Équipe</span>
          </button>
        </div>
      </nav>
    </>
  )
}
