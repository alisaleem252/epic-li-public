import type { Metadata } from "next"
import { DemoProfile } from "@/components/marketing/demo-profile"

export const metadata: Metadata = {
  title: "Demo profile | epic.li",
  description: "A fictional sample of an epic.li Stripe revenue profile. No live Stripe data is connected.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function DemoPage() {
  return <DemoProfile />
}
