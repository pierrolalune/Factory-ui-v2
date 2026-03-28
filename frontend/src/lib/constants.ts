const host = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1"

export const API_BASE_URL = `http://${host}:8000`
export const WS_BASE_URL = `ws://${host}:8000`
