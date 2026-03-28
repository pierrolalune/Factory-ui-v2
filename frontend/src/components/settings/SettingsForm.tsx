"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Loader2 } from "lucide-react"
import { GitHubSettings } from "./GitHubSettings"
import { PricingTable } from "./PricingTable"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"
import { useToastStore } from "@/store/toast-store"

export interface SettingsFormValues {
  defaultModel: string
  skipPermissions: boolean
  worktreeBasePath: string
  pricing: {
    opusInput: number
    opusOutput: number
    sonnetInput: number
    sonnetOutput: number
    haikuInput: number
    haikuOutput: number
  }
}

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Opus 4.6 (most capable)" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6 (balanced)" },
  { value: "claude-haiku-4-5", label: "Haiku 4.5 (fastest)" },
]

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-[18px] font-semibold text-[#dce8f5]">{title}</h2>
      <div className="flex-1 h-px bg-[#263245]" />
    </div>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-[#dce8f5] mb-1.5">
      {children}
    </label>
  )
}

function SkeletonForm() {
  return (
    <div className="space-y-8 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-4 w-40 rounded bg-[#1f2a3e]" />
          <div className="h-px w-full bg-[#1f2a3e]" />
          <div className="h-10 w-full rounded bg-[#1f2a3e]" />
          <div className="h-10 w-2/3 rounded bg-[#1f2a3e]" />
        </div>
      ))}
    </div>
  )
}

export function SettingsForm() {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const addToast = useToastStore((s) => s.addToast)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsFormValues>({
    defaultValues: {
      defaultModel: "claude-sonnet-4-6",
      skipPermissions: false,
      worktreeBasePath: "",
      pricing: {
        opusInput: 15,
        opusOutput: 75,
        sonnetInput: 3,
        sonnetOutput: 15,
        haikuInput: 0.8,
        haikuOutput: 4,
      },
    },
  })

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      reset({
        defaultModel: settings.defaultModel,
        skipPermissions: settings.skipPermissions,
        worktreeBasePath: settings.worktreeBasePath ?? "",
        pricing: settings.pricing,
      })
    }
  }, [settings, reset])

  async function onSubmit(values: SettingsFormValues) {
    try {
      await updateSettings.mutateAsync({
        defaultModel: values.defaultModel,
        skipPermissions: values.skipPermissions,
        worktreeBasePath: values.worktreeBasePath || undefined,
        pricing: values.pricing,
      })
      addToast("success", "Settings saved")
      reset(values) // Reset dirty state
    } catch {
      addToast("error", "Failed to save settings")
    }
  }

  if (isLoading) return <SkeletonForm />

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 max-w-[960px]">
      {/* GitHub Integration */}
      <section>
        <SectionHeader title="GitHub Integration" />
        {settings && <GitHubSettings settings={settings} />}
      </section>

      {/* Claude Defaults */}
      <section>
        <SectionHeader title="Claude Defaults" />
        <div className="space-y-6">
          <div>
            <FieldLabel htmlFor="defaultModel">Default Model</FieldLabel>
            <select
              id="defaultModel"
              {...register("defaultModel")}
              className="border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg
                px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4195e8]
                focus:border-[#4195e8] min-w-[240px]"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="skipPermissions"
                {...register("skipPermissions")}
                className="h-4 w-4 rounded border-[#263245] bg-[#1f2a3e] accent-[#4195e8]"
              />
              <FieldLabel htmlFor="skipPermissions">Skip Permissions (global default)</FieldLabel>
            </div>
            <p className="mt-1.5 text-xs text-[#8299b8] ml-7">
              Adds <code className="font-mono text-[#a8bdd4]">--dangerously-skip-permissions</code>{" "}
              to all runs. Can be overridden per-run in the Launch panel.
            </p>
          </div>
        </div>
      </section>

      {/* Paths */}
      <section>
        <SectionHeader title="Paths" />
        <div>
          <FieldLabel htmlFor="worktreeBasePath">Worktree Base Path (optional)</FieldLabel>
          <input
            id="worktreeBasePath"
            type="text"
            {...register("worktreeBasePath")}
            placeholder={`Default: {project}/../{project_name}-worktrees/`}
            className="w-full border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg
              px-3 py-2 text-sm placeholder:text-[#607896]
              focus:outline-none focus:ring-2 focus:ring-[#4195e8] focus:border-[#4195e8]
              font-mono"
          />
        </div>
      </section>

      {/* Token Pricing */}
      <section>
        <SectionHeader title="Token Pricing (USD per million tokens)" />
        <PricingTable register={register} errors={errors} />
      </section>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={updateSettings.isPending || !isDirty}
          className="inline-flex items-center gap-2 rounded-lg bg-[#4195e8] px-6 py-2.5 text-sm
            font-medium text-white hover:bg-[#5aabf5] transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {updateSettings.isPending && <Loader2 size={14} className="animate-spin" />}
          Save Changes
        </button>
      </div>
    </form>
  )
}
