import { parseGitHubRepositoryUrl } from "./github-url-parser.util";
import { BadRequestException } from "@nestjs/common";

describe("parseGitHubRepositoryUrl", () => {
  describe("Valid URLs", () => {
    it("should parse standard https URL", () => {
      const res = parseGitHubRepositoryUrl("https://github.com/owner/repo");
      expect(res).toEqual({
        owner: "owner",
        repo: "repo",
        fullName: "owner/repo",
        canonicalUrl: "https://github.com/owner/repo",
      });
    });

    it("should parse and normalize URL with trailing slash", () => {
      const res = parseGitHubRepositoryUrl(
        "https://github.com/facebook/react/",
      );
      expect(res.fullName).toBe("facebook/react");
      expect(res.canonicalUrl).toBe("https://github.com/facebook/react");
    });

    it("should parse and strip .git suffix", () => {
      const res = parseGitHubRepositoryUrl(
        "https://github.com/Ujjawal-0103/HackFront.git",
      );
      expect(res).toEqual({
        owner: "Ujjawal-0103",
        repo: "HackFront",
        fullName: "Ujjawal-0103/HackFront",
        canonicalUrl: "https://github.com/Ujjawal-0103/HackFront",
      });
    });

    it("should parse URL with branch or subfolder fragments", () => {
      const res = parseGitHubRepositoryUrl(
        "https://github.com/torvalds/linux/tree/master/kernel",
      );
      expect(res.owner).toBe("torvalds");
      expect(res.repo).toBe("linux");
      expect(res.fullName).toBe("torvalds/linux");
      expect(res.canonicalUrl).toBe("https://github.com/torvalds/linux");
    });

    it("should accept www.github.com", () => {
      const res = parseGitHubRepositoryUrl(
        "https://www.github.com/vercel/next.js",
      );
      expect(res.fullName).toBe("vercel/next.js");
    });

    it("should accept URL without protocol prefix and prepend https", () => {
      const res = parseGitHubRepositoryUrl(
        "github.com/acme-corp/payment-service",
      );
      expect(res.fullName).toBe("acme-corp/payment-service");
      expect(res.canonicalUrl).toBe(
        "https://github.com/acme-corp/payment-service",
      );
    });

    it("should allow hyphens, dots, and underscores in repository names", () => {
      const res = parseGitHubRepositoryUrl(
        "https://github.com/my-org/core_api.v2",
      );
      expect(res.owner).toBe("my-org");
      expect(res.repo).toBe("core_api.v2");
    });
  });

  describe("Security Rejections & Malformed URLs", () => {
    it("should reject empty or whitespace input", () => {
      expect(() => parseGitHubRepositoryUrl("")).toThrow(BadRequestException);
      expect(() => parseGitHubRepositoryUrl("   ")).toThrow(
        BadRequestException,
      );
      expect(() => parseGitHubRepositoryUrl(null as any)).toThrow(
        BadRequestException,
      );
    });

    it("should reject embedded credentials in URL", () => {
      expect(() =>
        parseGitHubRepositoryUrl("https://user:secret@github.com/owner/repo"),
      ).toThrow(BadRequestException);
    });

    it("should reject non-github hosts", () => {
      expect(() =>
        parseGitHubRepositoryUrl("https://gitlab.com/owner/repo"),
      ).toThrow(BadRequestException);
      expect(() =>
        parseGitHubRepositoryUrl("https://bitbucket.org/owner/repo"),
      ).toThrow(BadRequestException);
      expect(() =>
        parseGitHubRepositoryUrl("https://evil-github.com/owner/repo"),
      ).toThrow(BadRequestException);
    });

    it("should reject non-HTTP schemes", () => {
      expect(() =>
        parseGitHubRepositoryUrl("ssh://git@github.com/owner/repo.git"),
      ).toThrow(BadRequestException);
      expect(() =>
        parseGitHubRepositoryUrl("ftp://github.com/owner/repo"),
      ).toThrow(BadRequestException);
    });

    it("should reject URL with missing repository name", () => {
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/owner"),
      ).toThrow(BadRequestException);
      expect(() => parseGitHubRepositoryUrl("https://github.com/")).toThrow(
        BadRequestException,
      );
    });

    it("should reject reserved GitHub service paths", () => {
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/settings/apps"),
      ).toThrow(BadRequestException);
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/explore/repos"),
      ).toThrow(BadRequestException);
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/pricing/overview"),
      ).toThrow(BadRequestException);
    });

    it("should reject invalid owner format", () => {
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/-invalid-owner/repo"),
      ).toThrow(BadRequestException);
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/invalid--owner/repo"),
      ).toThrow(BadRequestException);
    });

    it("should reject dot directory traversals", () => {
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/owner/.."),
      ).toThrow(BadRequestException);
      expect(() =>
        parseGitHubRepositoryUrl("https://github.com/owner/."),
      ).toThrow(BadRequestException);
    });
  });
});
