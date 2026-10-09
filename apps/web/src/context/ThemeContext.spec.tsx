import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from "./ThemeContext";
import { ThemeToggle } from "../components/ThemeToggle";

function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
      <ThemeToggle />
    </div>
  );
}

describe("Theme System & Persistence (TH-01 through TH-08)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("TH-01/TH-04: defaults to light mode on first visit with empty localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("TH-02/TH-03: toggles to dark mode and persists preference to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    const toggleBtn = screen.getByRole("button", {
      name: /switch to dark mode/i,
    });
    act(() => {
      fireEvent.click(toggleBtn);
    });

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("TH-04/TH-06: restores previously saved dark preference on initial mount", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("TH-04/TH-07: falls back safely to light mode if stored value is invalid", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "invalid-random-theme");

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("TH-03/TH-07: ThemeToggle renders with correct accessible attributes and updates on click", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = screen.getByRole("button", { name: /switch to dark mode/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    act(() => {
      fireEvent.click(toggle);
    });

    const updatedToggle = screen.getByRole("button", {
      name: /switch to light mode/i,
    });
    expect(updatedToggle).toHaveAttribute("aria-pressed", "true");
  });
});
