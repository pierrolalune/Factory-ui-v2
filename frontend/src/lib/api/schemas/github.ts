import { z } from "zod/v4"

export const RemoteInfoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  defaultBranch: z.string(),
  htmlUrl: z.string(),
})

export const PushResultSchema = z.object({
  ok: z.boolean(),
  remoteUrl: z.string(),
  error: z.string().optional(),
})

export const PullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  url: z.string(),
  state: z.enum(["open", "closed", "merged"]),
  headBranch: z.string(),
  baseBranch: z.string(),
  createdAt: z.string(),
})

export type RemoteInfo = z.infer<typeof RemoteInfoSchema>
export type PushResult = z.infer<typeof PushResultSchema>
export type PullRequest = z.infer<typeof PullRequestSchema>
