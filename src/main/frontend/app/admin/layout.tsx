/**
 * Admin layout – forces dark theme regardless of user preference.
 * This ensures the admin UI always uses the dark colour palette it was designed for.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark">
      <div className="min-h-screen bg-slate-950 text-white">
        {children}
      </div>
    </div>
  )
}

