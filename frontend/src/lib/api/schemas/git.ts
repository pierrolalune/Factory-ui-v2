import { z } from "zod/v4"

// ---------------------------------------------------------------------------
// Git schemas
// ---------------------------------------------------------------------------

export const GitFileChangeSchema = z.object({
  path: z.string(),
  changeType: z.string(),
  oldPath: z.string().optional(),
})

export const GitStatusSchema = z.object({
  branch: z.string(),
  isDirty: z.boolean(),
  staged: z.array(GitFileChangeSchema),
  unstaged: z.array(GitFileChangeSchema),
  untracked: z.array(z.string()),
  ahead: z.number(),
  behind: z.number(),
})

export const DiffLineSchema = z.object({
  type: z.enum(["context", "add", "remove"]),
  content: z.string(),
  oldLineNo: z.number().optional(),
  newLineNo: z.number().optional(),
})

export const DiffHunkSchema = z.object({
  header: z.string(),
  lines: z.array(DiffLineSchema),
})

export const GitDiffSchema = z.object({
  filePath: z.string(),
  isStaged: z.boolean(),
  isBinary: z.boolean(),
  hunks: z.array(DiffHunkSchema),
})

export const GitCommitSchema = z.object({
  hash: z.string(),
  message: z.string(),
  author: z.string(),
  date: z.string(),
})

// ---------------------------------------------------------------------------
// Worktree schemas
// ---------------------------------------------------------------------------

export const WorktreeSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  branch: z.string(),
  path: z.string(),
  baseBranch: z.string(),
  createdAt: z.string(),
  isDirty: z.boolean(),
  ahead: z.number(),
  commitSha: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GitFileChange = z.infer<typeof GitFileChangeSchema>
export type GitStatus = z.infer<typeof GitStatusSchema>
export type DiffLine = z.infer<typeof DiffLineSchema>
export type DiffHunk = z.infer<typeof DiffHunkSchema>
export type GitDiff = z.infer<typeof GitDiffSchema>
export type GitCommit = z.infer<typeof GitCommitSchema>
export type Worktree = z.infer<typeof WorktreeSchema>
