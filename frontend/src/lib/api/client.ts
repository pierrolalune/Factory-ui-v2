import { API_BASE_URL } from "@/lib/constants"

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new ApiError(response.status, error.detail ?? "Unknown error", error.code)
    }
    return response.json() as Promise<T>
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new ApiError(response.status, error.detail ?? "Unknown error", error.code)
    }
    return response.json() as Promise<T>
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new ApiError(response.status, error.detail ?? "Unknown error", error.code)
    }
    return response.json() as Promise<T>
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, { method: "DELETE" })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      throw new ApiError(response.status, error.detail ?? "Unknown error", error.code)
    }
    return response.json() as Promise<T>
  }
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export const api = new ApiClient(API_BASE_URL)
