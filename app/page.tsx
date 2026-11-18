import { HomePage } from "@/components/marketing/home-page"
import { getFeaturedProfileCard } from "@/lib/featured-profile"

// Same cadence as public profile pages: re-read the featured profile at most once a minute.
export const revalidate = 60

export default async function Page() {
  const featured = await getFeaturedProfileCard()
  return <HomePage featured={featured} />
}
