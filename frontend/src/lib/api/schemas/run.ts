import { z } from "zod/v4"

export const RunSummarySchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string().optional(),
  type: z.string().default("command"),
  commandStem: z.string().optional(),
  commandArgs: z.string().optional(),
  branch: z.string().optional(),
  worktreePath: z.string().optional(),
  status: z.string().default("completed"),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationSeconds: z.number().optional(),
  costUsd: z.number().optional(),
  phase: z.string().optional(),
})

export type RunSummary = z.infer<typeof RunSummarySchema>
