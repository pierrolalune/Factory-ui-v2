import { SettingsForm } from "@/components/settings/SettingsForm"

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-8 text-[32px] font-bold tracking-[-1px] text-[#dce8f5]">Settings</h1>
      <SettingsForm />
    </div>
  )
}
