import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { EditProfileGate } from "@/components/marketing/edit-profile-gate"
import { SiteFooter } from "@/components/marketing/site-footer"
import { SiteHeader } from "@/components/marketing/site-header"
import { getPublicProfile, normalizeHandle } from "@/lib/profiles"

type EditProfilePageProps = {
  params: Promise<{ handle: string }>
}

export async function generateMetadata({ params }: EditProfilePageProps): Promise<Metadata> {
  const { handle } = await params
  const normalizedHandle = normalizeHandle(handle)
  return {
    title: normalizedHandle ? `Edit @${normalizedHandle} | epic.li` : "Edit profile | epic.li",
    description: "Edit a public epic.li profile by confirming the original revenue-provider credential.",
  }
}

export default async function EditProfilePage({ params }: EditProfilePageProps) {
  const { handle } = await params
  const data = await getPublicProfile(handle)
  if (!data) notFound()

  const { profile } = data

  return (
    <div className="min-h-screen bg-[#fdf9f0] text-[#1c1c16]">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[0.88fr_1.12fr] lg:items-start">
        <div className="space-y-6">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#087d32]">
              // Provider owner verification
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-black uppercase leading-[0.9] tracking-[-0.08em] sm:text-6xl">
              Same secret. Same profile.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-[#53614e] sm:text-base">
              No account or password is required. Enter the same {data.provider.name} secret originally connected to @{profile.handle} once to unlock the editor. It is compared server-side and is never shown back to you.
            </p>
          </div>
          <div className="border-2 border-[#1c1c16] bg-[#e7f6e7] p-5 shadow-[5px_5px_0px_#1c1c16]">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#087d32]">Privacy boundary</p>
            <p className="mt-2 text-sm leading-6 text-[#3d3d35]">
              Your contact email stays private. Only your website, app, and social links are published on the public profile. You can clear optional fields at any time.
            </p>
          </div>
          <Link
            href={`/@${profile.handle}`}
            className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[#53614e] underline decoration-[#00b943] decoration-2 underline-offset-4 hover:text-[#1c1c16]"
          >
            Back to @{profile.handle}
          </Link>
        </div>
        <EditProfileGate
          handle={profile.handle}
          providerId={data.provider.id}
          providerName={data.provider.name}
        />
      </main>
      <SiteFooter
        brand="epic.li // profile edit"
        note="Profile changes require the original provider credential."
      />
    </div>
  )
}
