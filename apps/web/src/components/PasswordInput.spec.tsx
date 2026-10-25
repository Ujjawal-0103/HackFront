import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordInput } from "./PasswordInput";

describe("PasswordInput Component", () => {
  it("renders with input type='password' by default", () => {
    render(
      <PasswordInput
        id="test-password"
        value="secret123"
        onChange={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("password");
    expect(input.value).toBe("secret123");

    const toggleButton = screen.getByRole("button", { name: /show password/i });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("type", "button");
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles to input type='text' when toggle button is clicked, then back to password", () => {
    render(
      <PasswordInput
        id="test-password"
        value="secret123"
        onChange={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: /show password/i });

    // Click to show password
    fireEvent.click(toggleButton);
    expect(input.type).toBe("text");
    expect(
      screen.getByRole("button", { name: /hide password/i }),
    ).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-pressed", "true");

    // Click again to hide password
    fireEvent.click(toggleButton);
    expect(input.type).toBe("password");
    expect(
      screen.getByRole("button", { name: /show password/i }),
    ).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
  });

  it("respects disabled state", () => {
    render(
      <PasswordInput
        id="test-password"
        value="secret123"
        onChange={() => {}}
        disabled={true}
      />,
    );

    const input = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
    const toggleButton = screen.getByRole("button", { name: /show password/i });

    expect(input).toBeDisabled();
    expect(toggleButton).toBeDisabled();
  });
});
