import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import {
  PasswordStrengthIndicator,
  evaluatePasswordStrength,
} from "./PasswordStrengthIndicator";

describe("PasswordStrengthIndicator & evaluation logic", () => {
  describe("evaluatePasswordStrength", () => {
    it("reports Too short for empty password", () => {
      const res = evaluatePasswordStrength("");
      expect(res.level).toBe("Too short");
      expect(res.score).toBe(0);
      expect(res.isValid).toBe(false);
    });

    it("reports Too short for passwords with fewer than 8 characters", () => {
      const res = evaluatePasswordStrength("Ab1!");
      expect(res.level).toBe("Too short");
      expect(res.score).toBe(1);
      expect(res.isValid).toBe(false);
    });

    it("reports Weak for >=8 chars with only letters", () => {
      const res = evaluatePasswordStrength("abcdefghij");
      expect(res.level).toBe("Weak");
      expect(res.hasLetters).toBe(true);
      expect(res.hasNumbers).toBe(false);
      expect(res.isValid).toBe(false);
    });

    it("reports Weak/Fair when letters and numbers are present", () => {
      const res = evaluatePasswordStrength("abcdef12");
      expect(res.hasMinLength).toBe(true);
      expect(res.hasLetters).toBe(true);
      expect(res.hasNumbers).toBe(true);
      expect(res.isValid).toBe(true);
    });

    it("reports Strong for complex passwords with uppercase, numbers, and symbols", () => {
      const res = evaluatePasswordStrength("StrongP@ssw0rd2026!");
      expect(res.level).toBe("Strong");
      expect(res.score).toBe(4);
      expect(res.isValid).toBe(true);
    });
  });

  describe("PasswordStrengthIndicator UI rendering", () => {
    it("renders nothing when password is empty", () => {
      const { container } = render(<PasswordStrengthIndicator password="" />);
      expect(container.firstChild).toBeNull();
    });

    it("renders live strength label and criteria checklist", () => {
      render(<PasswordStrengthIndicator password="Password123" />);

      expect(screen.getByText("Fair")).toBeInTheDocument();
      expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
      expect(
        screen.getByText("Contains letters and numbers"),
      ).toBeInTheDocument();
    });
  });
});
