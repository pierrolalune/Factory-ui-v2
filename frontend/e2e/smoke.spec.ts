import { test, expect } from "@playwright/test"

test("app loads and renders cockpit", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("h1")).toContainText("Cockpit")
})

test("health check passes", async ({ request }) => {
  const response = await request.get("http://localhost:8000/api/health")
  expect(response.ok()).toBeTruthy()
  const data = await response.json()
  expect(data.status).toBe("ok")
  expect(data.version).toBe("2.0.0")
})
