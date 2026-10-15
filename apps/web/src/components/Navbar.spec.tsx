import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { ThemeProvider } from "../context/ThemeContext";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/repositories",
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
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
      screen.getByText("Human-Supervised Code Verification"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Alpha Corp Engineering (ws_alpha)"),
    ).toBeInTheDocument();
  });

  it("renders navigation links to Overview, Verify, History, Repositories, and Evidence", () => {
    render(
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>,
    );

    const overviewLink = screen.getByRole("link", { name: /^overview$/i });
    const verifyLink = screen.getByRole("link", { name: /^verify$/i });
    const historyLink = screen.getByRole("link", {
      name: /^history & reports$/i,
    });
    const reposLink = screen.getByRole("link", { name: /^repositories$/i });
    const evidenceLink = screen.getByRole("link", { name: /^evidence$/i });

    expect(overviewLink).toHaveAttribute("href", "/");
    expect(verifyLink).toHaveAttribute("href", "/verify");
    expect(historyLink).toHaveAttribute("href", "/history");
    expect(reposLink).toHaveAttribute("href", "/repositories");
    expect(evidenceLink).toHaveAttribute("href", "/evidence");
  });
});
