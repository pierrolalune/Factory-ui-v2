"use client"

import { ChevronDown, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type { LibraryFilters, LibraryItemSource, LibraryItemSummary, LibraryItemType } from "@/lib/api/schemas/library"
import { useLibraryTags } from "@/hooks/use-library"
import { TagPill } from "./TagPill"

interface LibraryFiltersProps {
  filters: LibraryFilters
  items: LibraryItemSummary[]
  onChange: (filters: LibraryFilters) => void
}

const TYPE_TABS: Array<{ value: LibraryItemType | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "command", label: "Commands" },
  { value: "workflow", label: "Workflows" },
  { value: "skill", label: "Skills" },
  { value: "claude-md", label: "Claude MD" },
]

const SOURCE_OPTIONS: Array<{ value: LibraryItemSource | "all"; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "builtin", label: "Built-in" },
  { value: "user", label: "Mine" },
  { value: "imported", label: "Imported" },
]

export function LibraryFilters({ filters, items, onChange }: LibraryFiltersProps) {
  const [searchDraft, setSearchDraft] = useState(filters.q ?? "")
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { data: allTags = [] } = useLibraryTags()

  // Keep stable refs to avoid stale closures in the debounce timer
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const handleSearchDebounced = useCallback((value: string) => {
    const timer = setTimeout(() => {
      onChangeRef.current({ ...filtersRef.current, q: value || undefined })
    }, 300)
    return timer
  }, [])

  // Debounce search — only re-runs when searchDraft changes
  useEffect(() => {
    const timer = handleSearchDebounced(searchDraft)
    return () => clearTimeout(timer)
  }, [searchDraft, handleSearchDebounced])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function countForType(type: LibraryItemType | "all") {
    if (type === "all") return items.length
    return items.filter((i) => i.type === type).length
  }

  function handleTypeClick(type: LibraryItemType | "all") {
    onChange({ ...filters, type: type === "all" ? undefined : type })
  }

  function handleSourceChange(source: LibraryItemSource | "all") {
    onChange({ ...filters, source: source === "all" ? undefined : source })
  }

  function addTag(tag: string) {
    const current = filters.tags ?? []
    if (!current.includes(tag)) {
      onChange({ ...filters, tags: [...current, tag] })
    }
    setTagDropdownOpen(false)
  }

  function removeTag(tag: string) {
    const current = filters.tags ?? []
    onChange({ ...filters, tags: current.filter((t) => t !== tag) })
  }

  const availableTags = allTags.filter((t) => !(filters.tags ?? []).includes(t))
  const activeType = filters.type ?? "all"
  const activeSource = filters.source ?? "all"

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#607896]" />
        <input
          type="text"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="Search library..."
          className="w-full rounded-lg border border-[#263245] bg-[#1f2a3e] py-2 pl-9 pr-3 text-sm text-[#dce8f5] placeholder:text-[#607896] focus:border-[#4195e8] focus:outline-none focus:ring-2 focus:ring-[#4195e8]"
        />
      </div>

      {/* Type tabs */}
      <div className="flex flex-wrap gap-1">
        {TYPE_TABS.map(({ value, label }) => {
          const count = countForType(value)
          const active = activeType === value
          return (
            <button
              key={value}
              onClick={() => handleTypeClick(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-[#4195e8] text-white"
                  : "border border-[#263245] bg-transparent text-[#a8bdd4] hover:bg-[#1f2a3e]"
              }`}
            >
              {label}
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? "bg-white/20" : "bg-[#263245]"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Source + tag row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Source radio */}
        <div className="flex items-center gap-2">
          {SOURCE_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="source"
                value={value}
                checked={activeSource === value}
                onChange={() => handleSourceChange(value)}
                className="accent-[#4195e8]"
              />
              <span className="text-xs text-[#a8bdd4]">{label}</span>
            </label>
          ))}
        </div>

        {/* Tag filter */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto relative" ref={dropdownRef}>
          {(filters.tags ?? []).map((tag) => (
            <TagPill key={tag} tag={tag} onRemove={removeTag} />
          ))}
          {availableTags.length > 0 && (
            <button
              onClick={() => setTagDropdownOpen((o) => !o)}
              className="flex items-center gap-1 rounded-md border border-[#263245] px-2.5 py-1 text-xs text-[#8299b8] hover:bg-[#1f2a3e] transition-colors"
            >
              + Add tag
              <ChevronDown size={12} />
            </button>
          )}
          {tagDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-[#263245] bg-[#192030] shadow-lg py-1">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="block w-full px-3 py-1.5 text-left text-xs text-[#dce8f5] hover:bg-[#1f2a3e] transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
