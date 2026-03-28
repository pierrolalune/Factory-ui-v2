"use client"

import type { UseFormRegister, FieldErrors } from "react-hook-form"
import type { SettingsFormValues } from "./SettingsForm"

interface PricingTableProps {
  register: UseFormRegister<SettingsFormValues>
  errors: FieldErrors<SettingsFormValues>
}

const PRICING_ROWS = [
  { label: "Opus", inputField: "opusInput", outputField: "opusOutput" },
  { label: "Sonnet", inputField: "sonnetInput", outputField: "sonnetOutput" },
  { label: "Haiku", inputField: "haikuInput", outputField: "haikuOutput" },
] as const

export function PricingTable({ register, errors }: PricingTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#263245]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#263245] bg-[#1f2a3e]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8299b8]">
              Model
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8299b8]">
              Input ($/M tokens)
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#8299b8]">
              Output ($/M tokens)
            </th>
          </tr>
        </thead>
        <tbody>
          {PRICING_ROWS.map((row) => (
            <tr key={row.label} className="border-b border-[#263245]/50 last:border-0">
              <td className="px-4 py-3 font-medium text-[#dce8f5]">{row.label}</td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  {...register(`pricing.${row.inputField}`, { valueAsNumber: true })}
                  className="w-28 border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg
                    px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4195e8]
                    focus:border-[#4195e8] font-mono"
                  aria-label={`${row.label} input price per million tokens`}
                />
                {errors.pricing?.[row.inputField] && (
                  <p className="mt-1 text-xs text-[#f25c5c]">
                    {errors.pricing[row.inputField]?.message}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  {...register(`pricing.${row.outputField}`, { valueAsNumber: true })}
                  className="w-28 border border-[#263245] bg-[#1f2a3e] text-[#dce8f5] rounded-lg
                    px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4195e8]
                    focus:border-[#4195e8] font-mono"
                  aria-label={`${row.label} output price per million tokens`}
                />
                {errors.pricing?.[row.outputField] && (
                  <p className="mt-1 text-xs text-[#f25c5c]">
                    {errors.pricing[row.outputField]?.message}
                  </p>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
