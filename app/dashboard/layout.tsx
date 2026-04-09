import BottomNav from '@/components/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-20 sm:pb-0">
        {children}
      </div>
      <BottomNav />
    </>
  )
}
