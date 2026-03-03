export interface ApiErrorPayload {
  detail?: string;
}

export function extractApiErrorMessage(defaultMessage: string, payload: ApiErrorPayload): string {
  if (typeof payload.detail === "string" && payload.detail.length > 0) {
    return payload.detail;
  }
  return defaultMessage;
}

export async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return extractApiErrorMessage(fallback, payload);
  } catch {
    return fallback;
  }
}
