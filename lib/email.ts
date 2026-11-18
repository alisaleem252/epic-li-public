import "server-only"

import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"

/**
 * Transactional email through Amazon SES. Configure with:
 *   SES_REGION, SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY, EMAIL_FROM (e.g. "epic.li <hello@epic.li>")
 * The names deliberately avoid the AWS_ prefix, which Vercel reserves for its own runtime.
 * Nothing sends email yet; call sendEmail() from a route when a feature needs it.
 */

export function isEmailConfigured() {
  return Boolean(
    process.env.SES_REGION && process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY && process.env.EMAIL_FROM,
  )
}

let client: SESv2Client | null = null

function getClient() {
  client ??= new SESv2Client({
    region: process.env.SES_REGION,
    credentials: {
      accessKeyId: process.env.SES_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.SES_SECRET_ACCESS_KEY as string,
    },
  })
  return client
}

export async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html?: string }) {
  if (!isEmailConfigured()) throw new Error("Email is not configured")
  await getClient().send(
    new SendEmailCommand({
      FromEmailAddress: process.env.EMAIL_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: text, Charset: "UTF-8" }, ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}) },
        },
      },
    }),
  )
}
