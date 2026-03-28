"use client"

import { use, useEffect } from "react"
import { PanelRight } from "lucide-react"
import { useIDEStore } from "@/store/ide-store"
import { RunNavigator } from "@/components/project/RunNavigator"
import { ProjectOverview } from "@/components/project/ProjectOverview"
import { TerminalPlaceholder } from "@/components/terminal/TerminalPlaceholder"
import { LaunchTab } from "@/components/project/LaunchTab"
import { BranchesTab } from "@/components/project/BranchesTab"
import { ReviewTab } from "@/components/project/ReviewTab"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ focusRun?: string }>
}

type RightTab = "launch" | "branches" | "review"

const RIGHT_TABS: { key: RightTab; label: string }[] = [
  { key: "launch", label: "Launch" },
  { key: "branches", label: "Branches" },
  { key: "review", label: "Review" },
]

export default function ProjectIDEPage({ params, searchParams }: PageProps) {
  const { id: projectId } = use(params)
  const { focusRun: focusRunFromSearch } = use(searchParams)

  const {
    initProject,
    centerMode,
    focusedRunId,
    showOverview,
    focusRun,
    activeRightTab,
    setActiveRightTab,
    rightPanelVisible,
    toggleRightPanel,
  } = useIDEStore()

  // Initialize store for this project on mount
  useEffect(() => {
    initProject(projectId)
  }, [projectId, initProject])

  // If URL has ?focusRun=..., focus that run after init
  useEffect(() => {
    if (focusRunFromSearch) {
      focusRun(focusRunFromSearch)
    }
  }, [focusRunFromSearch, focusRun])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: Run Navigator (280px fixed) */}
      <div className="w-[280px] shrink-0 flex flex-col overflow-hidden">
        <RunNavigator projectId={projectId} />
      </div>

      {/* Center area: flex, main */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#10161f]">
        {centerMode === "overview" && <ProjectOverview projectId={projectId} />}
        {centerMode === "terminal" && focusedRunId && (
          <TerminalPlaceholder runId={focusedRunId} onClose={showOverview} />
        )}
        {centerMode === "editor" && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[#607896]">File editor coming in Sprint 3.</p>
          </div>
        )}
      </div>

      {/* Right panel: 340px, hidden on <1024px unless toggled */}
      <div
        className={`shrink-0 flex flex-col border-l border-[#263245] bg-[#192030] overflow-hidden
          transition-all duration-200
          ${rightPanelVisible ? "w-[340px]" : "w-0"}`}
      >
        {rightPanelVisible && (
          <>
            {/* Tab bar */}
            <div className="flex border-b border-[#263245] shrink-0">
              {RIGHT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveRightTab(tab.key)}
                  className={`flex-1 py-2.5 text-xs font-medium transition-colors
                    ${activeRightTab === tab.key
                      ? "text-[#4195e8] border-b-2 border-[#4195e8] -mb-px"
                      : "text-[#607896] hover:text-[#a8bdd4]"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeRightTab === "launch" && <LaunchTab />}
              {activeRightTab === "branches" && <BranchesTab />}
              {activeRightTab === "review" && <ReviewTab projectId={projectId} />}
            </div>
          </>
        )}
      </div>

      {/* Toggle right panel button — visible on all sizes */}
      <button
        onClick={toggleRightPanel}
        className="absolute right-4 top-20 z-10 p-1.5 rounded-lg border border-[#263245] bg-[#192030]
          text-[#607896] hover:text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors
          hidden lg:flex"
        aria-label="Toggle right panel"
      >
        <PanelRight size={14} />
      </button>
    </div>
  )
}
