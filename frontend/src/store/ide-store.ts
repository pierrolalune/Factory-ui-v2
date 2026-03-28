"use client"

import { create } from "zustand"

type LeftMode = "runs" | "files"
type CenterMode = "overview" | "terminal" | "editor"
type RightTab = "launch" | "branches" | "git" | "review"

interface IDEStore {
  projectId: string | null

  // Left panel mode
  leftMode: LeftMode
  setLeftMode: (mode: LeftMode) => void

  // File tree expanded directories
  expandedDirs: Set<string>
  toggleDir: (path: string) => void

  // Center area mode
  centerMode: CenterMode
  focusedRunId: string | null
  focusRun: (runId: string) => void
  showOverview: () => void

  // Open file editor tabs
  openFiles: string[]
  activeFile: string | null
  openFile: (path: string) => void
  closeFile: (path: string) => void

  // Right panel
  activeRightTab: RightTab
  setActiveRightTab: (tab: RightTab) => void
  rightPanelVisible: boolean
  toggleRightPanel: () => void

  // Selected worktree (affects file tree root and editor paths)
  selectedWorktreePath: string | null
  setSelectedWorktreePath: (path: string | null) => void

  // Merge UI state (per worktree)
  expandedMergePanel: string | null
  setMergePanel: (id: string | null) => void

  // Initialize store for a project — resets transient state
  initProject: (projectId: string) => void
}

export const useIDEStore = create<IDEStore>()((set) => ({
  projectId: null,

  leftMode: "runs",
  setLeftMode: (mode) => set({ leftMode: mode }),

  expandedDirs: new Set<string>(),
  toggleDir: (path) =>
    set((state) => {
      const next = new Set(state.expandedDirs)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return { expandedDirs: next }
    }),

  centerMode: "overview",
  focusedRunId: null,
  focusRun: (runId) => set({ centerMode: "terminal", focusedRunId: runId }),
  showOverview: () => set({ centerMode: "overview", focusedRunId: null }),

  openFiles: [],
  activeFile: null,
  openFile: (path) =>
    set((state) => ({
      centerMode: "editor",
      activeFile: path,
      openFiles: state.openFiles.includes(path) ? state.openFiles : [...state.openFiles, path],
    })),
  closeFile: (path) =>
    set((state) => {
      const remaining = state.openFiles.filter((f) => f !== path)
      const activeFile = state.activeFile === path ? (remaining[remaining.length - 1] ?? null) : state.activeFile
      const centerMode = remaining.length === 0 && activeFile === null ? "overview" : state.centerMode
      return { openFiles: remaining, activeFile, centerMode }
    }),

  activeRightTab: "launch",
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  rightPanelVisible: true,
  toggleRightPanel: () => set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),

  selectedWorktreePath: null,
  setSelectedWorktreePath: (path) => set({ selectedWorktreePath: path }),

  expandedMergePanel: null,
  setMergePanel: (id) => set({ expandedMergePanel: id }),

  // Reset transient state when switching projects
  initProject: (projectId) =>
    set({
      projectId,
      leftMode: "runs",
      centerMode: "overview",
      focusedRunId: null,
      openFiles: [],
      activeFile: null,
      expandedDirs: new Set<string>(),
      expandedMergePanel: null,
      selectedWorktreePath: null,
    }),
}))
