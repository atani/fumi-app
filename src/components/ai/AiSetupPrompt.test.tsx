import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AiSetupPrompt } from "./AiSetupPrompt";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("AiSetupPrompt", () => {
  it("renders the setup call-to-action", () => {
    render(
      <MemoryRouter>
        <AiSetupPrompt />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("ai-setup-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("ai-setup-button")).toBeInTheDocument();
  });

  it("navigates to settings when the button is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AiSetupPrompt />
        <LocationDisplay />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("ai-setup-button"));
    expect(screen.getByTestId("location")).toHaveTextContent("/settings");
  });
});
