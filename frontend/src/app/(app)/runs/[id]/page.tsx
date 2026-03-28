import { RunDetail } from "@/components/runs/RunDetail"

interface RunViewerPageProps {
  params: Promise<{ id: string }>
}

export default async function RunViewerPage({ params }: RunViewerPageProps) {
  const { id } = await params
  return (
    <div className="flex flex-col h-full">
      <RunDetail runId={id} />
    </div>
  )
}
