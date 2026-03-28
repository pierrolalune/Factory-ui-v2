import { z } from "zod/v4"

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  githubRemote: z.string().optional(),
  createdAt: z.string(),
  lastRunAt: z.string().optional(),
})

export const ProjectSummarySchema = ProjectSchema.extend({
  activeRunCount: z.number(),
  lastRunStatus: z.enum(["completed", "failed", "cancelled"]).optional(),
  lastRunCostUsd: z.number().optional(),
})

export type Project = z.infer<typeof ProjectSchema>
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>

// PathInfo — returned by GET /api/projects/validate-path
export const pathInfoSchema = z.object({
  exists: z.boolean(),
  alreadyRegistered: z.boolean(),
  existingProjectId: z.string().optional(),
  isGitRepo: z.boolean(),
  hasClaudeMd: z.boolean(),
  suggestedName: z.string().optional(),
  detectedStack: z.array(z.string()).optional(),
})

export type PathInfo = z.infer<typeof pathInfoSchema>

// DirectoryEntry — used in browse and discover responses
export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isProjectCandidate: z.boolean(),
  childrenCount: z.number(),
  detectedStack: z.array(z.string()).optional(),
})

export type DirectoryEntry = z.infer<typeof directoryEntrySchema>

// BrowseResponse — returned by GET /api/system/browse
export const browseResponseSchema = z.object({
  currentPath: z.string(),
  parentPath: z.string().optional(),
  entries: z.array(directoryEntrySchema),
})

export type BrowseResponse = z.infer<typeof browseResponseSchema>

// DiscoverResponse — returned by GET /api/system/discover-projects
export const discoverResponseSchema = z.object({
  candidates: z.array(directoryEntrySchema),
})

export type DiscoverResponse = z.infer<typeof discoverResponseSchema>

// CreateProjectRequest — POST /api/projects body
export interface CreateProjectRequest {
  name: string
  path: string
  description?: string
  githubRemote?: string
  initGit?: boolean
}

// CreateProjectResponse — POST /api/projects response
export interface CreateProjectResponse {
  id: string
  gitInitialized: boolean
}
