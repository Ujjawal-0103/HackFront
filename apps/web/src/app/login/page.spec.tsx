import React from "react";
import "@testing-library/jest-dom";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import LoginPage from "./page";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockLogin = jest.fn();
jest.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    error: null,
  }),
}));

describe("LoginPage Component (Sprint 2 & 6 Auth)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders email and password inputs and sign-in button", () => {
    render(<LoginPage />);

    expect(screen.getByText("Sign In to Traceback")).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /register here/i }),
    ).toHaveAttribute("href", "/register");
  });

  it("submits valid credentials and navigates on success", async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "developer@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "Password123!" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });

    expect(mockLogin).toHaveBeenCalledWith({
      email: "developer@company.com",
      password: "Password123!",
    });
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("displays error message on invalid credentials", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Invalid email or password"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "wrong@company.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "badpass" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });
});
