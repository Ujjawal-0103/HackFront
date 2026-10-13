import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EvidencePage from "./page";
import { api } from "../../lib/api";

jest.mock("../../lib/api");
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const mockRepositories = [
  {
    id: "repo-123",
    workspaceId: "ws_alpha",
    fullName: "Ujjawal-0103/HackFront",
    defaultBranch: "main",
    isPrivate: false,
    counts: { commits: 10, pullRequests: 2, issues: 4, sourceRecords: 15 },
  },
];

const mockSearchResults = {
  query: "socket leak",
  totalCount: 1,
  executionTimeMs: 14,
  graphAvailable: false,
  items: [
    {
      source: {
        id: "source-1",
        repositoryId: "repo-123",
        sourceType: "COMMIT",
        externalId: "1234567890",
        referenceKey: "1234567",
        title: "fix: prevent socket reconnection buffer leak",
        author: "Jane Maintainer",
        url: "https://github.com/Ujjawal-0103/HackFront/commit/1234567",
        snippet: "Buffer capacity capped at 500 records.",
        filePath: "src/socket.ts",
        recordedAt: "2026-05-01T12:00:00Z",
      },
      score: 5.4,
      retrievalMethod: "lexical",
      matchReasons: [
        'Exact match on reference key "1234567"',
        "Title matches keyword: socket",
      ],
    },
  ],
};

describe("EvidencePage (Sprint 4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.getRepositories as jest.Mock).mockResolvedValue(mockRepositories);
  });

  it("renders search input and initial instructions", async () => {
    render(<EvidencePage />);

    await waitFor(() => {
      expect(screen.getByText("Evidence Explorer")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Historical Evidence Grounding Search"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/memory leak socket reconnection/i),
    ).toBeInTheDocument();
  });

  it("submits search query and renders result cards with score and explanation", async () => {
    (api.searchEvidence as jest.Mock).mockResolvedValue(mockSearchResults);

    render(<EvidencePage />);

    await waitFor(() => {
      expect(screen.getByText(/Ujjawal-0103\/HackFront/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      /memory leak socket reconnection/i,
    );
    fireEvent.change(input, { target: { value: "socket leak" } });

    const searchBtn = screen.getByRole("button", { name: /^search$/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(api.searchEvidence).toHaveBeenCalledWith(
        "repo-123",
        expect.objectContaining({ query: "socket leak" }),
      );
      expect(
        screen.getByText("fix: prevent socket reconnection buffer leak"),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Score: 5.4")).toBeInTheDocument();
    expect(
      screen.getByText("✓ Title matches keyword: socket"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Buffer capacity capped at 500 records."),
    ).toBeInTheDocument();
  });

  it("renders honest insufficient evidence state when no results match", async () => {
    (api.searchEvidence as jest.Mock).mockResolvedValue({
      query: "fabricated non-existent term",
      totalCount: 0,
      executionTimeMs: 5,
      graphAvailable: false,
      items: [],
    });

    render(<EvidencePage />);

    await waitFor(() => {
      expect(screen.getByText(/Ujjawal-0103\/HackFront/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      /memory leak socket reconnection/i,
    );
    fireEvent.change(input, {
      target: { value: "fabricated non-existent term" },
    });

    const searchBtn = screen.getByRole("button", { name: /^search$/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Insufficient Historical Evidence Found"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Absence of evidence is not proof that a claim is false/i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("opens inspect modal when Inspect Record button is clicked", async () => {
    (api.searchEvidence as jest.Mock).mockResolvedValue(mockSearchResults);
    (api.getSourceRecord as jest.Mock).mockResolvedValue(
      mockSearchResults.items[0].source,
    );

    render(<EvidencePage />);

    await waitFor(() => {
      expect(screen.getByText(/Ujjawal-0103\/HackFront/)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      /memory leak socket reconnection/i,
    );
    fireEvent.change(input, { target: { value: "socket leak" } });
    fireEvent.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(
        screen.getByText("fix: prevent socket reconnection buffer leak"),
      ).toBeInTheDocument();
    });

    const inspectBtn = screen.getByRole("button", { name: /inspect record/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(
        screen.getByText("Canonical GitHub Artifact:"),
      ).toBeInTheDocument();
      expect(screen.getByText("Jane Maintainer")).toBeInTheDocument();
    });
  });
});
