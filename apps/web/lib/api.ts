export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return fetch(`/api/coach${normalizedPath}`, init);
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = await response.json();
      return body?.detail ?? body?.message ?? fallback;
    }
    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}
