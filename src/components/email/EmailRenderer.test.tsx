import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmailRenderer } from "./EmailRenderer";

describe("EmailRenderer", () => {
  describe("plain text fallback", () => {
    it("renders text content when html is null", () => {
      render(<EmailRenderer html={null} text="Hello plain text" />);
      const el = screen.getByTestId("email-renderer-text");
      expect(el).toHaveTextContent("Hello plain text");
    });

    it("renders empty string when both html and text are null", () => {
      render(<EmailRenderer html={null} text={null} />);
      const el = screen.getByTestId("email-renderer-text");
      expect(el).toHaveTextContent("");
    });
  });

  describe("HTML rendering", () => {
    it("renders an iframe when html is provided", () => {
      render(<EmailRenderer html="<p>Hello</p>" text={null} />);
      const iframe = screen.getByTestId("email-renderer-iframe");
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute("sandbox", "allow-same-origin");
    });

    it("sets iframe title for accessibility", () => {
      render(<EmailRenderer html="<p>Test</p>" text={null} />);
      const iframe = screen.getByTestId("email-renderer-iframe");
      expect(iframe).toHaveAttribute("title", "Email content");
    });
  });
});
