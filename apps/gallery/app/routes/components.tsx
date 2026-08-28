import type { Route } from "./+types/components"
import { PageHeader } from "@/components/site/page-header"

export function meta({}: Route.MetaArgs) {
  return [{ title: "Components — Agent UI" }]
}

export default function Components(): React.JSX.Element {
  return (
    <div className="space-y-12 py-8">
      <PageHeader
        title="Components"
        description="Agent-native React components built on the shadcn registry."
      />
    </div>
  )
}
