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

    // Should have Google login button
    const loginButton = page.getByTestId("google-login-button");
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toContainText("Sign in with Google");
  });

  test("should show client ID input when no client ID is configured", async ({
    page,
  }) => {
    await page.goto("/login");

    // Click Google login button
    const loginButton = page.getByTestId("google-login-button");
    await loginButton.click();

    // Should show client ID input (since no client ID is stored in DB)
    const clientIdInput = page.getByTestId("client-id-input");
    await expect(clientIdInput).toBeVisible();

    // Should have submit button
    const submitButton = page.getByTestId("submit-client-id");
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeDisabled(); // disabled when empty
  });

  test("should enable submit button when client ID is entered", async ({
    page,
  }) => {
    await page.goto("/login");

    const loginButton = page.getByTestId("google-login-button");
    await loginButton.click();

    const clientIdInput = page.getByTestId("client-id-input");
    await clientIdInput.fill("test-client-id.apps.googleusercontent.com");

    const submitButton = page.getByTestId("submit-client-id");
    await expect(submitButton).toBeEnabled();
  });

  test("should have correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Fumi");
  });
});
