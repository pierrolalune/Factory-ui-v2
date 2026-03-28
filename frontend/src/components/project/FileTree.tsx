"use client"

import { ChevronRight, ChevronDown, Folder, File } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api/client"
import { toCamelCase } from "@/lib/utils/camel-case"
import { useIDEStore } from "@/store/ide-store"

interface FileTreeNode {
  name: string
  path: string
  type: "file" | "directory"
  children?: FileTreeNode[]
}

interface FileTreeProps {
  projectId: string
}

function TreeNode({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) {
  const { expandedDirs, toggleDir, openFile } = useIDEStore()
  const isExpanded = expandedDirs.has(node.path)
  const indent = depth * 12

  if (node.type === "directory") {
    return (
      <div>
        <button
          onClick={() => toggleDir(node.path)}
          className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-[#1f2a3e] transition-colors text-left rounded"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-[#607896] shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-[#607896] shrink-0" />
          )}
          <Folder size={14} className="text-[#4195e8] shrink-0" />
          <span className="text-sm text-[#dce8f5] truncate">{node.name}</span>
        </button>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => openFile(node.path)}
      className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-[#1f2a3e] transition-colors text-left rounded"
      style={{ paddingLeft: `${8 + indent + 16}px` }}
    >
      <File size={14} className="text-[#607896] shrink-0" />
      <span className="text-sm text-[#a8bdd4] truncate">{node.name}</span>
    </button>
  )
}

export function FileTree({ projectId }: FileTreeProps) {
  const { selectedWorktreePath } = useIDEStore()

  const { data: tree, isLoading, error } = useQuery<FileTreeNode[]>({
    queryKey: ["file-tree", projectId, selectedWorktreePath],
    queryFn: async () => {
      const params = selectedWorktreePath
        ? `?worktree_path=${encodeURIComponent(selectedWorktreePath)}`
        : ""
      const raw = await api.get<unknown[]>(`/api/projects/${projectId}/file-tree${params}`)
      return toCamelCase<FileTreeNode[]>(raw)
    },
    enabled: Boolean(projectId),
    staleTime: 10_000,
  })

  if (isLoading) {
    return (
      <div className="p-3 space-y-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-6 bg-[#1f2a3e] rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
        ))}
      </div>
    )
  }

  if (error || !tree) {
    return <p className="p-3 text-xs text-[#f25c5c]">Failed to load file tree.</p>
  }

  if (tree.length === 0) {
    return <p className="p-3 text-xs text-[#607896]">No files found.</p>
  }

  return (
    <div className="py-1 overflow-y-auto">
      {tree.map((node) => (
        <TreeNode key={node.path} node={node} />
      ))}
    </div>
  )
}
