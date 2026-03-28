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

// Full run model returned by GET /api/run/{run_id} and run_info WS events
export const RunSchema = z.object({
  runId: z.string(),
  type: z.enum(["command", "raw", "resume"]),
  status: z.enum(["pending", "active", "awaiting_input", "completed", "failed", "cancelled"]),
  exitCode: z.number().optional(),
  projectId: z.string(),
  projectName: z.string(),
  projectPath: z.string(),
  worktreePath: z.string().optional(),
  commandStem: z.string().optional(),
  commandArgs: z.string().optional(),
  prompt: z.string(),
  branch: z.string().optional(),
  effort: z.enum(["low", "medium", "high", "max"]).optional(),
  skipPermissions: z.boolean(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationMs: z.number().optional(),
  claudeSessionId: z.string().optional(),
  sessionName: z.string().optional(),
  totalCostUsd: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  numTurns: z.number().optional(),
  errorMessage: z.string().optional(),
  awaitingInput: z.boolean(),
})

export type Run = z.infer<typeof RunSchema>

// Command info from GET /api/projects/{id}/commands
export const CommandInfoSchema = z.object({
  stem: z.string(),
  name: z.string(),
  description: z.string(),
  sourcePath: z.string(),
  type: z.enum(["command", "agent", "skill"]),
  hasArguments: z.boolean(),
})

export type CommandInfo = z.infer<typeof CommandInfoSchema>

// Launch command request/response
export const LaunchCommandRequestSchema = z.object({
  projectId: z.string(),
  stem: z.string(),
  args: z.string().optional(),
  worktreeId: z.string().nullable().optional(),
  effort: z.enum(["auto", "low", "medium", "high", "max"]).nullable().optional(),
  skipPermissions: z.boolean().optional(),
})

export type LaunchCommandRequest = z.infer<typeof LaunchCommandRequestSchema>

export const LaunchRunResponseSchema = z.object({
  runId: z.string(),
  warning: z.string().optional(),
  warningMessage: z.string().optional(),
})

export type LaunchRunResponse = z.infer<typeof LaunchRunResponseSchema>

// Launch raw request
export const LaunchRawRequestSchema = z.object({
  projectId: z.string(),
  worktreeId: z.string().nullable().optional(),
  skipPermissions: z.boolean().optional(),
})

export type LaunchRawRequest = z.infer<typeof LaunchRawRequestSchema>

// Resume run request
export const ResumeRunRequestSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  worktreeId: z.string().nullable().optional(),
})

export type ResumeRunRequest = z.infer<typeof ResumeRunRequestSchema>

// WS message types
export type WsPhase = "thinking" | "tool_use" | "text" | "idle"

export interface WsPtyOutput {
  type: "pty_output"
  data: string
}

export interface WsStatusUpdate {
  type: "status_update"
  status: string
  exitCode?: number
}

export interface WsAwaitingInputUpdate {
  type: "awaiting_input_update"
  awaitingInput: boolean
}

export interface WsPhaseUpdate {
  type: "phase_update"
  phase: WsPhase
  toolName?: string
  filePath?: string
}

export interface WsCostUpdate {
  type: "cost_update"
  costUsd: number
  inputTokens: number
  outputTokens: number
  numTurns: number
}

export interface WsRunInfo {
  type: "run_info"
  run: Run
}

export type WsMessage =
  | WsPtyOutput
  | WsStatusUpdate
  | WsAwaitingInputUpdate
  | WsPhaseUpdate
  | WsCostUpdate
  | WsRunInfo
