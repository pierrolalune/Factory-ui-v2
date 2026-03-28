import { z } from "zod/v4"

export const PricingConfigSchema = z.object({
  opusInput: z.number(),
  opusOutput: z.number(),
  sonnetInput: z.number(),
  sonnetOutput: z.number(),
  haikuInput: z.number(),
  haikuOutput: z.number(),
})

export const SettingsSchema = z.object({
  githubTokenSet: z.boolean(),
  githubTokenMasked: z.string().optional(),
  githubUsername: z.string().optional(),
  githubTokenValid: z.boolean().optional(),
  defaultModel: z.string(),
  skipPermissions: z.boolean(),
  worktreeBasePath: z.string().optional(),
  pricing: PricingConfigSchema,
})

export type PricingConfig = z.infer<typeof PricingConfigSchema>
export type Settings = z.infer<typeof SettingsSchema>
