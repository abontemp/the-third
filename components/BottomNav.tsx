'use client'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, User, Award, BarChart2 } from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Accueil',  icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Profil',   icon: User,            href: '/dashboard/profile' },
  { label: 'Badges',   icon: Award,           href: '/dashboard/badges' },
  { label: 'Stats',    icon: BarChart2,        href: '/dashboard/stats' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
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
      </div>
    </nav>
  )
}
