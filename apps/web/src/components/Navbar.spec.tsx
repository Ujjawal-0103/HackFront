import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { ThemeProvider } from "../context/ThemeContext";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/repositories",
}));

describe("Navbar Component", () => {
  it("renders Traceback branding, problem statement, and workspace badge", () => {
    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );

    expect(screen.getByText("Traceback")).toBeInTheDocument();
    expect(
      screen.getByText("Code Rationale Verification (T1.1)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Alpha Corp (ws_alpha)")).toBeInTheDocument();
  });

  it("renders navigation links to Overview, Repositories, and Evidence", () => {
    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );

    const overviewLink = screen.getByRole("link", { name: /overview/i });
    const reposLink = screen.getByRole("link", {
      name: /repositories & ingestion/i,
    });
    const evidenceLink = screen.getByRole("link", {
      name: /evidence explorer/i,
    });

    expect(overviewLink).toHaveAttribute("href", "/");
    expect(reposLink).toHaveAttribute("href", "/repositories");
    expect(evidenceLink).toHaveAttribute("href", "/evidence");
  });
});
