import {
  sanitizeDiff,
  redactSecrets,
  truncateDiff,
  isBinaryFile,
  isGeneratedOrMinified,
  MAX_DIFF_SIZE_BYTES,
  TRUNCATION_MARKER,
} from "./diff-sanitizer";

describe("Git Diff Sanitizer (Sprint 3 Part 3)", () => {
  describe("Binary file exclusion", () => {
    it("should recognize binary extensions and return null diffHunk with isBinary true", () => {
      const binaryFiles = [
        "assets/logo.png",
        "photos/profile.jpg",
        "icons/favicon.ico",
        "docs/whitepaper.pdf",
        "dist/bundle.wasm",
        "fonts/inter.woff2",
        "archives/release.zip",
        "data/records.sqlite",
      ];

      for (const file of binaryFiles) {
        const result = sanitizeDiff(file, "some fake binary patch text");
        expect(result.isBinary).toBe(true);
        expect(result.diffHunk).toBeNull();
      }
    });

    it("should detect git binary patch markers in diff header even with generic extension", () => {
      const patch = "GIT binary patch\nliteral 12345\nzc${5#2j...";
      const result = sanitizeDiff("src/data.dat", patch);
      expect(result.isBinary).toBe(true);
      expect(result.diffHunk).toBeNull();
    });

    it("should detect null bytes in patch text as binary", () => {
      const patch = "diff --git a/test b/test\n\0\0\0binarycontent";
      const result = sanitizeDiff("src/unknown.xyz", patch);
      expect(result.isBinary).toBe(true);
      expect(result.diffHunk).toBeNull();
    });

    it("should detect 'Binary files ... differ' message in patch text", () => {
      const patch = "Binary files a/image.raw and b/image.raw differ";
      const result = sanitizeDiff("src/image.raw", patch);
      expect(result.isBinary).toBe(true);
      expect(result.diffHunk).toBeNull();
    });
  });

  describe("Minified and generated artifact exclusion", () => {
    it("should exclude minified files (.min.js, .min.css)", () => {
      const patch = "@@ -1,1 +1,1 @@\n-var a=1;\n+var a=2;";
      const jsResult = sanitizeDiff("public/vendor.min.js", patch);
      expect(jsResult.isSkipped).toBe(true);
      expect(jsResult.diffHunk).toBeNull();

      const cssResult = sanitizeDiff("styles/bootstrap.min.css", patch);
      expect(cssResult.isSkipped).toBe(true);
      expect(cssResult.diffHunk).toBeNull();
    });

    it("should exclude source maps (*.map)", () => {
      const patch = '{"version":3,"file":"out.js","sources":["in.js"]}';
      const result = sanitizeDiff("dist/app.js.map", patch);
      expect(result.isSkipped).toBe(true);
      expect(result.diffHunk).toBeNull();
    });

    it("should exclude dependency lockfiles (package-lock.json, pnpm-lock.yaml)", () => {
      const patch =
        "@@ -1,5 +1,5 @@\n-lockfileVersion: 5.4\n+lockfileVersion: 6.0";
      expect(sanitizeDiff("package-lock.json", patch).isSkipped).toBe(true);
      expect(sanitizeDiff("pnpm-lock.yaml", patch).isSkipped).toBe(true);
      expect(sanitizeDiff("yarn.lock", patch).isSkipped).toBe(true);
      expect(sanitizeDiff("Cargo.lock", patch).isSkipped).toBe(true);
    });

    it("should exclude files inside generated build directories (dist, build, .next, node_modules)", () => {
      const patch = "@@ -1,1 +1,1 @@\n+export const generated = true;";
      expect(sanitizeDiff("dist/index.js", patch).isSkipped).toBe(true);
      expect(sanitizeDiff(".next/server/page.js", patch).isSkipped).toBe(true);
      expect(
        sanitizeDiff("coverage/lcov-report/index.html", patch).isSkipped,
      ).toBe(true);
      expect(sanitizeDiff("node_modules/pkg/index.js", patch).isSkipped).toBe(
        true,
      );
    });
  });

  describe("Secret redaction", () => {
    it("should redact GitHub Personal Access Tokens and App tokens", () => {
      const patch = `
@@ -10,3 +10,3 @@
-const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
+const token = "github_pat_11AAAAAAA0123456789_abcdefghijklmnopqrstuvwxyz";
+const oauth = "gho_16characterstokenforgithuboauth012345";
      `;

      const sanitized = redactSecrets(patch);
      expect(sanitized).not.toContain(
        "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      );
      expect(sanitized).not.toContain(
        "github_pat_11AAAAAAA0123456789_abcdefghijklmnopqrstuvwxyz",
      );
      expect(sanitized).not.toContain(
        "gho_16characterstokenforgithuboauth012345",
      );
      expect(sanitized).toContain("[REDACTED_GITHUB_TOKEN]");
    });

    it("should redact private key blocks completely", () => {
      const patch = `
@@ -1,7 +1,7 @@
+-----BEGIN RSA PRIVATE KEY-----
+MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz0123456789+/==
+MIIEowIBAAKCAQEA0Y1+abcdefghijklmnopqrstuvwxyz0123456789+/==
+-----END RSA PRIVATE KEY-----
      `;

      const sanitized = redactSecrets(patch);
      expect(sanitized).not.toContain("MIIEowIBAAKCAQEA0Y1+");
      expect(sanitized).toContain("[REDACTED_PRIVATE_KEY]");
    });

    it("should redact database URLs containing username and password", () => {
      const patch = `
@@ -5,3 +5,3 @@
-DATABASE_URL="postgresql://postgres:supersecretpass@localhost:5432/mydb?schema=public"
+MONGODB_URI="mongodb://admin:p%40ssw0rd@mongo.internal:27017/prod"
+REDIS_URL="redis://default:redispassword123@cache.internal:6379"
      `;

      const sanitized = redactSecrets(patch);
      expect(sanitized).not.toContain("supersecretpass");
      expect(sanitized).not.toContain("p%40ssw0rd");
      expect(sanitized).not.toContain("redispassword123");
      expect(sanitized).toContain(
        "postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@localhost:5432/mydb?schema=public",
      );
      expect(sanitized).toContain(
        "mongodb://[REDACTED_USER]:[REDACTED_PASSWORD]@mongo.internal:27017/prod",
      );
      expect(sanitized).toContain(
        "redis://[REDACTED_USER]:[REDACTED_PASSWORD]@cache.internal:6379",
      );
    });

    it("should redact API keys, client secrets, and passwords while preserving variable context", () => {
      const patch = `
@@ -20,5 +20,5 @@
 const apiKey = "AIzaSyD-1234567890abcdefghijklmn";
 const client_secret = "cs_live_9876543210zyxwvutsrq";
 const password = "MyP@ssw0rd12345!";
 const auth_token: "secret_token_value_xyz123";
      `;

      const sanitized = redactSecrets(patch);
      expect(sanitized).not.toContain("AIzaSyD-1234567890abcdefghijklmn");
      expect(sanitized).not.toContain("cs_live_9876543210zyxwvutsrq");
      expect(sanitized).not.toContain("MyP@ssw0rd12345!");
      expect(sanitized).not.toContain("secret_token_value_xyz123");

      // Verifies variable names and structure remain intact
      expect(sanitized).toContain('const apiKey = "[REDACTED_SECRET]";');
      expect(sanitized).toContain('const client_secret = "[REDACTED_SECRET]";');
      expect(sanitized).toContain('const password = "[REDACTED_SECRET]";');
      expect(sanitized).toContain('const auth_token: "[REDACTED_SECRET]";');
    });

    it("should redact AWS keys and Bearer tokens", () => {
      const patch = `
@@ -1,3 +1,3 @@
-AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
+Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefg
      `;

      const sanitized = redactSecrets(patch);
      expect(sanitized).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(sanitized).toContain("[REDACTED_AWS_KEY]");
      expect(sanitized).toContain("Bearer [REDACTED_TOKEN]");
    });
  });

  describe("50 KB truncation boundary", () => {
    it("should not truncate diffs under 50 KB", () => {
      const patch = "@@ -1,1 +1,1 @@\n+const small = true;\n".repeat(100);
      const result = truncateDiff(patch);
      expect(result.isTruncated).toBe(false);
      expect(result.text).toBe(patch);
    });

    it("should safely truncate diffs exceeding 50 KB and append the truncation marker", () => {
      // Create a patch that exceeds 50 KB (e.g. 70 KB)
      const line =
        "+const line = 'this is a repeated line for large patch testing';\n";
      const largePatch = line.repeat(1200); // ~75 KB
      expect(largePatch.length).toBeGreaterThan(MAX_DIFF_SIZE_BYTES);

      const result = truncateDiff(largePatch);
      expect(result.isTruncated).toBe(true);
      expect(result.text.length).toBeLessThanOrEqual(MAX_DIFF_SIZE_BYTES);
      expect(result.text).toContain(TRUNCATION_MARKER);
    });

    it("should enforce the 50 KB limit in sanitizeDiff integration", () => {
      const line = "+export const val = 1234567890;\n";
      const hugePatch = line.repeat(2000); // ~64 KB
      const result = sanitizeDiff("src/components/LargeList.tsx", hugePatch);
      expect(result.isTruncated).toBe(true);
      expect(result.diffHunk).not.toBeNull();
      expect(result.diffHunk!.length).toBeLessThanOrEqual(MAX_DIFF_SIZE_BYTES);
      expect(result.diffHunk!).toContain(TRUNCATION_MARKER);
    });
  });

  describe("Ordinary source diff preservation", () => {
    it("should preserve standard TypeScript code without alteration", () => {
      const cleanPatch = `
@@ -10,6 +10,12 @@
 export function calculateMetrics(input: number[]): number {
+  if (!input || input.length === 0) {
+    return 0;
+  }
   return input.reduce((acc, curr) => acc + curr, 0);
 }
       `.trim();

      const result = sanitizeDiff("src/utils/metrics.ts", cleanPatch);
      expect(result.isBinary).toBe(false);
      expect(result.isSkipped).toBe(false);
      expect(result.isTruncated).toBe(false);
      expect(result.diffHunk).toBe(cleanPatch);
    });
  });

  describe("Zero raw secret leakage in output", () => {
    it("should never leave raw token strings in the output", () => {
      const rawSecret = "ghp_111122223333444455556666777788889999";
      const rawDbPass = "super_classified_password_999";
      const patch = `
+const ghToken = "${rawSecret}";
+const conn = "postgres://root:${rawDbPass}@db.prod:5432/main";
      `;

      const result = sanitizeDiff("src/config.ts", patch);
      expect(result.diffHunk).not.toBeNull();
      expect(result.diffHunk).not.toContain(rawSecret);
      expect(result.diffHunk).not.toContain(rawDbPass);
    });
  });
});
