import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
import type { ProviderRawResponse } from "./metrics"

const responseStorage = new AsyncLocalStorage<ProviderRawResponse[]>()

export async function captureProviderRawResponses<T>(task: () => Promise<T>) {
  const responses: ProviderRawResponse[] = []
  const result = await responseStorage.run(responses, task)
  return { result, responses }
}

export function recordProviderRawResponse(response: ProviderRawResponse) {
  responseStorage.getStore()?.push(response)
}
