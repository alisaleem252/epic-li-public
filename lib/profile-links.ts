export const PROFILE_SOCIAL_PLATFORMS = [
  {
    key: "x",
    label: "X",
    placeholder: "https://x.com/username",
    allowedHosts: ["x.com", "twitter.com"],
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/username",
    allowedHosts: ["instagram.com"],
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/in/username",
    allowedHosts: ["linkedin.com"],
  },
  {
    key: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@username",
    allowedHosts: ["tiktok.com"],
  },
  {
    key: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@channel",
    allowedHosts: ["youtube.com", "youtu.be"],
  },
  {
    key: "github",
    label: "GitHub",
    placeholder: "https://github.com/username",
    allowedHosts: ["github.com"],
  },
  {
    key: "bluesky",
    label: "Bluesky",
    placeholder: "https://bsky.app/profile/handle",
    allowedHosts: ["bsky.app"],
  },
  {
    key: "threads",
    label: "Threads",
    placeholder: "https://threads.net/@username",
    allowedHosts: ["threads.net"],
  },
] as const

export type ProfileSocialPlatform = (typeof PROFILE_SOCIAL_PLATFORMS)[number]["key"]
export type ProfileSocialLinks = Partial<Record<ProfileSocialPlatform, string>>

export type ProfileFieldsValue = {
  handle: string
  displayName: string
  bio: string
  contactEmail: string
  websiteUrl: string
  appUrl: string
  socialLinks: ProfileSocialLinks
}

export const EMPTY_PROFILE_FIELDS: ProfileFieldsValue = {
  handle: "",
  displayName: "",
  bio: "",
  contactEmail: "",
  websiteUrl: "",
  appUrl: "",
  socialLinks: {},
}
