"use client"

import { useState } from "react"

import { useCreateLibraryItem, useUpdateLibraryItem } from "@/hooks/use-library"
import type { LibraryItem, LibraryItemCreateRequest, LibraryItemType } from "@/lib/api/schemas/library"
import { TagPill } from "./TagPill"

interface LibraryItemFormProps {
  item?: LibraryItem
  onSuccess?: (id: string) => void
  onCancel?: () => void
}

const TYPES: LibraryItemType[] = ["command", "workflow", "skill", "claude-md"]

export function LibraryItemForm({ item, onSuccess, onCancel }: LibraryItemFormProps) {
  const isEditing = Boolean(item)
  const createMutation = useCreateLibraryItem()
  const updateMutation = useUpdateLibraryItem()

  const [name, setName] = useState(item?.name ?? "")
  const [type, setType] = useState<LibraryItemType>(item?.type ?? "command")
  const [description, setDescription] = useState(item?.description ?? "")
  const [content, setContent] = useState(item?.content ?? "")
  const [tags, setTags] = useState<string[]>(item?.tags ?? [])
  const [tagInput, setTagInput] = useState("")
  const [commandTemplate, setCommandTemplate] = useState(item?.config?.command ?? "")
  const [error, setError] = useState<string | null>(null)

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().toLowerCase()
      if (!tags.includes(tag)) {
        setTags([...tags, tag])
      }
      setTagInput("")
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload: LibraryItemCreateRequest = {
      name: name.trim(),
      type,
      description: description.trim(),
      content,
      tags,
      config: type === "command" && commandTemplate ? { command: commandTemplate, args: [] } : undefined,
    }

    try {
      if (isEditing && item) {
        await updateMutation.mutateAsync({ id: item.id, data: payload })
        onSuccess?.(item.id)
      } else {
        const result = await createMutation.mutateAsync(payload)
        onSuccess?.(result.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#8299b8] uppercase tracking-wider">
          Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="my-command"
          className="w-full rounded-lg border border-[#263245] bg-[#1f2a3e] px-3 py-2 text-sm text-[#dce8f5] placeholder:text-[#607896] focus:border-[#4195e8] focus:outline-none focus:ring-2 focus:ring-[#4195e8]"
        />
      </div>

      {/* Type */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#8299b8] uppercase tracking-wider">
          Type <span className="text-red-400">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-[#4195e8]"
              />
              <span className="text-sm text-[#dce8f5] capitalize">{t}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#8299b8] uppercase tracking-wider">
          Description <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="What does this item do?"
          className="w-full rounded-lg border border-[#263245] bg-[#1f2a3e] px-3 py-2 text-sm text-[#dce8f5] placeholder:text-[#607896] focus:border-[#4195e8] focus:outline-none focus:ring-2 focus:ring-[#4195e8]"
        />
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#8299b8] uppercase tracking-wider">Tags</label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[#263245] bg-[#1f2a3e] px-3 py-2 min-h-[38px]">
          {tags.map((tag) => (
            <TagPill key={tag} tag={tag} onRemove={(t) => setTags(tags.filter((x) => x !== t))} />
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleAddTag}
            placeholder={tags.length === 0 ? "Type and press Enter…" : ""}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-[#dce8f5] placeholder:text-[#607896] focus:outline-none"
          />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <label className="block text-xs font-medium text-[#8299b8] uppercase tracking-wider">
          Content (Markdown) <span className="text-red-400">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={12}
          placeholder="# My Item&#10;&#10;$ARGUMENTS"
          className="w-full rounded-lg border border-[#263245] bg-[#1f2a3e] px-3 py-2 font-mono text-sm text-[#dce8f5] placeholder:text-[#607896] focus:border-[#4195e8] focus:outline-none focus:ring-2 focus:ring-[#4195e8] resize-y"
        />
      </div>

      {/* Command config */}
      {type === "command" && (
        <div className="space-y-1 border-t border-[#263245] pt-4">
          <label className="block text-xs font-medium text-[#8299b8] uppercase tracking-wider">
            Command Template
          </label>
          <input
            type="text"
            value={commandTemplate}
            onChange={(e) => setCommandTemplate(e.target.value)}
            placeholder="/my-command {ARGUMENTS}"
            className="w-full rounded-lg border border-[#263245] bg-[#1f2a3e] px-3 py-2 font-mono text-sm text-[#dce8f5] placeholder:text-[#607896] focus:border-[#4195e8] focus:outline-none focus:ring-2 focus:ring-[#4195e8]"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-[#f25c5c]">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#263245] px-4 py-2 text-sm font-medium text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-[#4195e8] px-4 py-2 text-sm font-medium text-white hover:bg-[#5aabf5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving…" : isEditing ? "Save Changes" : "Save Item"}
        </button>
      </div>
    </form>
  )
}
