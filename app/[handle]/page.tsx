import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PublicProfile } from "@/components/marketing/public-profile"
import { getProfileAudience } from "@/lib/audience"
import { getProfileCharts, getPublicProfile, normalizeHandle } from "@/lib/profiles"

type PublicProfilePageProps = {
  params: Promise<{ handle: string }>
}

export const revalidate = 60

export async function generateMetadata({ params }: PublicProfilePageProps): Promise<Metadata> {
  const { handle } = await params
  const normalizedHandle = normalizeHandle(handle)

  return {
    title: normalizedHandle ? `@${normalizedHandle} | epic.li` : "Profile not found | epic.li",
    description: normalizedHandle
      ? `Public revenue profile for @${normalizedHandle} on epic.li.`
      : "This epic.li profile could not be found.",
  }
}

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { handle } = await params
  const profile = await getPublicProfile(handle)

  if (!profile) notFound()

  const [{ trajectories, insights }, audience] = await Promise.all([
    getProfileCharts(profile.profile.id, profile.snapshot?.currency ?? null),
    getProfileAudience(profile.profile.id),
  ])

  return <PublicProfile data={profile} trajectories={trajectories} insights={insights} audience={audience} />
}
