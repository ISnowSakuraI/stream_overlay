const DEFAULT_TIMEOUT_MS = 8_000;

export class HttpError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

// A single fetch wrapper keeps third-party failures from stalling the stream.
export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new HttpError(`Upstream HTTP ${response.status}`, response.status);
    return response;
  } catch (error) {
    if (error.name === 'AbortError') throw new HttpError(`Upstream request timed out after ${timeoutMs}ms`, 504);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function retry(operation, { attempts = 2, delayMs = 300 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}
