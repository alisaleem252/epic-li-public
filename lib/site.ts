/**
 * Canonical public origin used in anything that leaves the page: embed snippets, QR codes,
 * metadata. Never derive it from the request, or a visit via a preview/vercel.app URL leaks into
 * badges people paste elsewhere. Forks set NEXT_PUBLIC_SITE_URL to their own domain.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://epic.li").replace(/\/+$/, "")
