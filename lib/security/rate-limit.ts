import "server-only"

import { createHmac } from "node:crypto"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

let profileCreationLimiter: Ratelimit | undefined
let profileEditingLimiter: Ratelimit | undefined
let payloadViewingLimiter: Ratelimit | undefined
let editorAccessLimiter: Ratelimit | undefined
let profileResyncLimiter: Ratelimit | undefined
let handleCheckLimiter: Ratelimit | undefined
let showcaseLimiter: Ratelimit | undefined

function createProfileLimiter(
  prefix: string,
  limiter: ReturnType<typeof Ratelimit.slidingWindow> = Ratelimit.slidingWindow(5, "1 h"),
) {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error("Upstash rate limiting is not configured")

  return new Ratelimit({
    redis: new Redis({ url, token }),
    limiter,
    prefix,
  })
}

function getProfileCreationLimiter() {
  profileCreationLimiter ??= createProfileLimiter("epic-li:create-profile:v2")
  return profileCreationLimiter
}

function getProfileEditingLimiter() {
  profileEditingLimiter ??= createProfileLimiter("epic-li:edit-profile:v1")
  return profileEditingLimiter
}

function getPayloadViewingLimiter() {
  payloadViewingLimiter ??= createProfileLimiter("epic-li:payload-view:v1")
  return payloadViewingLimiter
}

function getEditorAccessLimiter() {
  editorAccessLimiter ??= createProfileLimiter("epic-li:editor-access:v1")
  return editorAccessLimiter
}

function getProfileResyncLimiter() {
  profileResyncLimiter ??= createProfileLimiter("epic-li:resync:v1")
  return profileResyncLimiter
}

function getShowcaseLimiter() {
  // Credential-gated like editing, but load + save + a couple of GitHub refreshes per session need more than 5/h.
  showcaseLimiter ??= createProfileLimiter("epic-li:showcase:v1", Ratelimit.slidingWindow(20, "1 h"))
  return showcaseLimiter
}

function getHandleCheckLimiter() {
  // Read-only lookups while typing, so far more generous than the mutation limits above.
  handleCheckLimiter ??= createProfileLimiter(
    "epic-li:handle-check:v1",
    Ratelimit.slidingWindow(60, "1 m"),
  )
  return handleCheckLimiter
}

function hashClientIp(clientIp: string) {
  const redisToken = process.env.KV_REST_API_TOKEN
  if (!redisToken) throw new Error("Upstash rate limiting is not configured")

  const identifierKey = createHmac("sha256", redisToken)
    .update("epic-li:rate-limit-identifier:v1")
    .digest()
  return createHmac("sha256", identifierKey).update(clientIp).digest("hex")
}

export function limitProfileCreation(clientIp: string) {
  return getProfileCreationLimiter().limit(hashClientIp(clientIp))
}

export function limitProfileEditing(clientIp: string) {
  return getProfileEditingLimiter().limit(hashClientIp(clientIp))
}

export function limitPayloadViewing(clientIp: string) {
  return getPayloadViewingLimiter().limit(hashClientIp(clientIp))
}

export function limitEditorAccess(clientIp: string) {
  return getEditorAccessLimiter().limit(hashClientIp(clientIp))
}

export function limitProfileResync(clientIp: string) {
  return getProfileResyncLimiter().limit(hashClientIp(clientIp))
}

export function limitShowcase(clientIp: string) {
  return getShowcaseLimiter().limit(hashClientIp(clientIp))
}

export function limitHandleCheck(clientIp: string) {
  return getHandleCheckLimiter().limit(hashClientIp(clientIp))
}
