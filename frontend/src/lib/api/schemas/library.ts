import { z } from "zod/v4"

export const LibraryItemTypeSchema = z.enum(["command", "workflow", "skill", "claude-md", "agent"])
export const LibraryItemSourceSchema = z.enum(["builtin", "user", "imported"])

export const CommandArgSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  required: z.boolean(),
  defaultValue: z.string().optional(),
})

export const CommandConfigSchema = z.object({
  command: z.string(),
  args: z.array(CommandArgSchema).default([]),
})

export const LibraryItemSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: LibraryItemTypeSchema,
  source: LibraryItemSourceSchema,
  description: z.string(),
  tags: z.array(z.string()).default([]),
  linkedCommandStem: z.string().optional(),
  hasStructuredArgs: z.boolean().default(false),
  updatedAt: z.string(),
})

export const LibraryItemSchema = LibraryItemSummarySchema.extend({
  content: z.string(),
  importedFrom: z.string().optional(),
  createdAt: z.string(),
  config: CommandConfigSchema.optional(),
  agentDeps: z.array(z.string()).default([]),
})

export const ScannedItemSchema = z.object({
  name: z.string(),
  type: LibraryItemTypeSchema,
  sourcePath: z.string(),
  description: z.string(),
  contentPreview: z.string(),
  alreadyInLibrary: z.boolean(),
  existingId: z.string().optional(),
})

export const ScanResponseSchema = z.object({
  scanRoot: z.string(),
  items: z.array(ScannedItemSchema),
})

export const ImportResultSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  overwritten: z.number(),
  errors: z.array(z.record(z.string(), z.string())).default([]),
})

export type LibraryItemType = z.infer<typeof LibraryItemTypeSchema>
export type LibraryItemSource = z.infer<typeof LibraryItemSourceSchema>
export type CommandArg = z.infer<typeof CommandArgSchema>
export type CommandConfig = z.infer<typeof CommandConfigSchema>
export type LibraryItemSummary = z.infer<typeof LibraryItemSummarySchema>
export type LibraryItem = z.infer<typeof LibraryItemSchema>
export type ScannedItem = z.infer<typeof ScannedItemSchema>
export type ScanResponse = z.infer<typeof ScanResponseSchema>
export type ImportResult = z.infer<typeof ImportResultSchema>

// Request types
export interface LibraryItemCreateRequest {
  name: string
  type: LibraryItemType
  description: string
  content: string
  tags: string[]
  config?: CommandConfig
  linkedCommandStem?: string
  agentDeps?: string[]
}

export interface LibraryItemUpdateRequest {
  name?: string
  description?: string
  content?: string
  tags?: string[]
  config?: CommandConfig
  linkedCommandStem?: string
  agentDeps?: string[]
}

export interface LibraryFilters {
  type?: LibraryItemType
  source?: LibraryItemSource
  tags?: string[]
  q?: string
}

export interface ImportRequestItem {
  sourcePath: string
  overwrite: boolean
}
