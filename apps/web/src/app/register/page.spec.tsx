import React from "react";
import "@testing-library/jest-dom";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import RegisterPage from "./page";

const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

const mockRegister = jest.fn();
jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    register: mockRegister,
    user: null,
    isLoading: false,
    error: null,
  }),
}));

describe("RegisterPage Component (Sprint 2 & 6 Registration)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("renders registration inputs and submit button", () => {
    render(<RegisterPage />);

    expect(screen.getByText("Create Traceback Account")).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login");
  });

  it("submits valid registration details and navigates to / on success", async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Taylor Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/work email address/i), {
      target: { value: "taylor@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "SecurePassword123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "SecurePassword123!" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    });

    expect(mockRegister).toHaveBeenCalledWith({
      name: "Taylor Engineer",
      email: "taylor@company.com",
      password: "SecurePassword123!",
      passwordConfirmation: "SecurePassword123!",
    });
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("preserves returnTo query param and navigates to intended destination on success", async () => {
    mockSearchParams = new URLSearchParams({ returnTo: "/repositories" });
    mockRegister.mockResolvedValueOnce(undefined);

    render(<RegisterPage />);

    expect(
      screen.getByRole("link", { name: /sign in/i }),
    ).toHaveAttribute("href", "/login?returnTo=%2Frepositories");

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Taylor Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/work email address/i), {
      target: { value: "taylor@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "SecurePassword123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "SecurePassword123!" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    });

    expect(mockPush).toHaveBeenCalledWith("/repositories");
  });

  it("rejects mismatched password confirmation with visible error alert", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Taylor Engineer" },
    });
    fireEvent.change(screen.getByLabelText(/work email address/i), {
      target: { value: "taylor@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "SecurePassword123!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "DifferentPassword456!" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    });

    expect(
      screen.getByText("Password confirmation does not match"),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
