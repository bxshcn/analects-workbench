export class FetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "FetchError";
    this.status = status;
  }
}

export function dataUrl(file: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/data/${file}`;
}

export async function fetchJson<T>(file: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(dataUrl(file), { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new FetchError("网络请求失败，请稍后重试", 0);
  }
  if (!response.ok) {
    throw new FetchError(`数据请求失败（${response.status}）`, response.status);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new FetchError("数据解析失败", response.status);
  }
}
