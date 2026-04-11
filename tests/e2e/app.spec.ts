import { test, expect } from "@playwright/test";

test.describe("Fumi App", () => {
  test("should show login page when not authenticated", async ({ page }) => {
    await page.goto("/");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Should display the Fumi branding
    await expect(page.getByText("Fumi")).toBeVisible();
    await expect(
      page.getByText("Fast, lightweight email client"),
    ).toBeVisible();

    // Should have credential inputs and login button
    await expect(page.getByTestId("client-id-input")).toBeVisible();
    await expect(page.getByTestId("client-secret-input")).toBeVisible();

    const loginButton = page.getByTestId("google-login-button");
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText("Sign in with Google");
  });

  test("should disable login button when client ID is empty", async ({
    page,
  }) => {
    await page.goto("/login");

    const loginButton = page.getByTestId("google-login-button");
    await expect(loginButton).toBeDisabled();
  });

  test("should enable login button when client ID is entered", async ({
    page,
  }) => {
    await page.goto("/login");

    const clientIdInput = page.getByTestId("client-id-input");
    await clientIdInput.fill("test-client-id.apps.googleusercontent.com");

    const loginButton = page.getByTestId("google-login-button");
    await expect(loginButton).toBeEnabled();
  });

  test("should have correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Fumi");
  });
});
