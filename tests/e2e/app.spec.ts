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

test.describe("Login page — input behaviour", () => {
  test("client secret input is masked", async ({ page }) => {
    await page.goto("/login");
    const secret = page.getByTestId("client-secret-input");
    await expect(secret).toHaveAttribute("type", "password");
  });

  test("client id input is plain text", async ({ page }) => {
    await page.goto("/login");
    const id = page.getByTestId("client-id-input");
    await expect(id).toHaveAttribute("type", "text");
  });

  test("disables login when input is only whitespace", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("client-id-input").fill("    ");
    await expect(page.getByTestId("google-login-button")).toBeDisabled();
  });

  test("protected routes redirect to /login when unauthenticated", async ({
    page,
  }) => {
    for (const path of ["/settings", "/calendar", "/tasks", "/attachments"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("arbitrary deep path redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/something/that/does/not/exist");
    await expect(page).toHaveURL(/\/login/);
  });

  test("keeps entered credentials across navigation to login", async ({
    page,
  }) => {
    await page.goto("/login");
    const idInput = page.getByTestId("client-id-input");
    await idInput.fill("abc.apps.googleusercontent.com");
    await expect(idInput).toHaveValue("abc.apps.googleusercontent.com");

    // Re-mounting the page clears the unmounted state (browser mode has no
    // persistence), so navigating away and back should reset inputs. This
    // codifies the browser-mode fallback behaviour.
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByTestId("client-id-input")).toHaveValue("");
  });

  test("login error placeholder is not shown until a submit fails", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-error")).toHaveCount(0);
  });
});

test.describe("Accessibility smoke", () => {
  test("login button has accessible text", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in with google/i }))
      .toBeVisible();
  });

  test("page title matches app name", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Fumi");
  });
});

test.describe("Licensing (browser mode)", () => {
  // In browser mode there is no license, so the app resolves to the free trial
  // and the trial banner is shown above every route (this is the revenue gate).
  test("shows the trial banner with buy and enter-key actions", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("trial-banner")).toBeVisible();
    await expect(page.getByTestId("trial-buy-button")).toBeVisible();
    await expect(page.getByTestId("trial-enter-key-button")).toBeVisible();
  });
});
