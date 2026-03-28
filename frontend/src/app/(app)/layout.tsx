export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg-body">
      <main>{children}</main>
    </div>
  )
}
