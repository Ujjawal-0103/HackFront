import {
  Injectable,
  Logger,
  BadRequestException,
  Optional,
  Inject,
} from "@nestjs/common";
import {
  ExtractedClaim,
  LlmClaimExtractionAdapter,
} from "./verification.types";

export interface ExtractClaimsOptions {
  explanation: string;
  codeSnippet?: string;
  targetFilePath?: string;
  targetSymbol?: string;
  maxClaims?: number;
}

@Injectable()
export class ClaimExtractorService {
  private readonly logger = new Logger(ClaimExtractorService.name);
  public static readonly MAX_EXPLANATION_LENGTH = 10000;
  public static readonly MAX_CODE_SNIPPET_LENGTH = 5000;
  public static readonly DEFAULT_MAX_CLAIMS = 10;

  constructor(
    @Optional()
    @Inject("LLM_CLAIM_EXTRACTION_ADAPTER")
    private llmAdapter?: LlmClaimExtractionAdapter,
  ) {}

  public setLlmAdapter(adapter: LlmClaimExtractionAdapter): void {
    this.llmAdapter = adapter;
  }

  // Patterns that attempt prompt injection or model directive hijacking
  private readonly INJECTION_PATTERNS = [
    /<\/?(?:system|prompt|instruction|developer|admin)[^>]*>/gi,
    /ignore\s+(?:all\s+)?(?:previous\s+)?instructions/gi,
    /disregard\s+(?:all\s+)?(?:prior\s+)?(?:rules|prompts)/gi,
    /mark\s+(?:all\s+)?claims?\s+(?:as\s+)?supported/gi,
    /override\s+verdict/gi,
    /you\s+must\s+output\s+supported/gi,
  ];

  // Prefixes that indicate conversational filler rather than historical rationale
  private readonly FLUFF_PREFIXES = [
    /^(?:in\s+this\s+(?:file|codebase|repository|function|snippet),?\s*)/i,
    /^(?:as\s+an?\s+ai\s+(?:assistant|model),?\s*)/i,
    /^(?:here\s+is\s+(?:why|the\s+explanation|what\s+happened):?\s*)/i,
    /^(?:let\s+me\s+explain\s+(?:why|how):?\s*)/i,
    /^(?:to\s+answer\s+your\s+question:?\s*)/i,
    /^(?:based\s+on\s+(?:my\s+analysis|the\s+code):?\s*)/i,
  ];

  /**
   * Asynchronously decomposes explanation text into reviewable atomic claims.
   * If an LLM adapter is available, attempts LLM-assisted atomic extraction with safe fallback to deterministic rules.
   */
  async extractClaimsAsync(
    options: ExtractClaimsOptions,
  ): Promise<ExtractedClaim[]> {
    if (this.llmAdapter && this.llmAdapter.isAvailable()) {
      try {
        const sanitizedExplanation = this.sanitizeAndIsolateInput(
          options.explanation,
        );
        const wrappedSnippet = options.codeSnippet
          ? this.wrapInUntrustedDiff(options.codeSnippet)
          : undefined;
        const llmClaims = await this.llmAdapter.extractClaims({
          explanation: sanitizedExplanation,
          codeSnippet: wrappedSnippet,
          targetSymbol: options.targetSymbol,
          targetFilePath: options.targetFilePath,
        });

        if (Array.isArray(llmClaims) && llmClaims.length > 0) {
          return llmClaims;
        }
        this.logger.warn(
          "LLM extraction returned empty results; falling back to deterministic extraction",
        );
      } catch (err) {
        this.logger.warn(
          `LLM claim extraction failed (${err instanceof Error ? err.message : String(err)}); falling back to deterministic extraction`,
        );
      }
    }

    return this.extractClaims(options);
  }

  /**
   * Sanitizes, isolates, and decomposes raw explanation text into reviewable claims.
   */
  extractClaims(options: ExtractClaimsOptions): ExtractedClaim[] {
    const rawExplanation = options.explanation?.trim();
    if (!rawExplanation) {
      throw new BadRequestException(
        "Explanation text is required and cannot be empty.",
      );
    }

    if (rawExplanation.length > ClaimExtractorService.MAX_EXPLANATION_LENGTH) {
      throw new BadRequestException(
        `Explanation exceeds maximum allowed length of ${ClaimExtractorService.MAX_EXPLANATION_LENGTH} characters.`,
      );
    }

    if (
      options.codeSnippet &&
      options.codeSnippet.length > ClaimExtractorService.MAX_CODE_SNIPPET_LENGTH
    ) {
      throw new BadRequestException(
        `Code snippet exceeds maximum allowed length of ${ClaimExtractorService.MAX_CODE_SNIPPET_LENGTH} characters.`,
      );
    }

    // 1. Sanitize input and neutralize prompt injection attempts (SEC-06)
    const sanitizedExplanation = this.sanitizeAndIsolateInput(rawExplanation);

    // 2. Deterministic sentence and list decomposition
    const rawSegments = this.segmentExplanation(sanitizedExplanation);

    // 3. Filter fluff, extract symbols, and structure into atomic claims
    const maxClaims =
      options.maxClaims || ClaimExtractorService.DEFAULT_MAX_CLAIMS;
    const claims: ExtractedClaim[] = [];

    for (const segment of rawSegments) {
      if (claims.length >= maxClaims) break;

      const cleanedClaimText = this.cleanClaimText(segment);
      if (
        !cleanedClaimText ||
        this.isTrivialSyntaxRestatement(cleanedClaimText)
      ) {
        continue;
      }

      const extractedSymbol =
        options.targetSymbol ||
        this.extractSymbol(cleanedClaimText, options.codeSnippet);

      claims.push({
        id: `claim-${claims.length + 1}`,
        text: cleanedClaimText,
        targetSymbol: extractedSymbol,
        order: claims.length + 1,
        rawSentence: segment,
      });
    }

    // If all text was filtered as fluff, fall back to the cleaned full text
    if (claims.length === 0 && sanitizedExplanation) {
      claims.push({
        id: "claim-1",
        text: sanitizedExplanation,
        targetSymbol: options.targetSymbol,
        order: 1,
        rawSentence: sanitizedExplanation,
      });
    }

    return claims;
  }

  /**
   * Wraps untrusted text in XML delimiters and neutralizes direct injection payloads (SEC-06)
   */
  public wrapInUntrustedDiff(diffText: string): string {
    const sanitized = diffText.replace(/<\/untrusted_diff>/gi, "");
    return `<untrusted_diff>\n${sanitized}\n</untrusted_diff>`;
  }

  /**
   * Neutralizes prompt injection directives and wraps text in protective XML tags
   */
  private sanitizeAndIsolateInput(text: string): string {
    let sanitized = text;

    // Neutralize injection patterns by stripping instruction overrides
    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        this.logger.warn(
          `Adversarial or directive pattern detected and sanitized in input explanation`,
        );
        sanitized = sanitized.replace(pattern, "[DATA_PAYLOAD_FILTERED]");
      }
    }

    return sanitized.trim();
  }

  /**
   * Segments text by list items, newlines, semicolons, and terminal sentence punctuation
   */
  private segmentExplanation(text: string): string[] {
    // Check if the explanation is a numbered or bulleted list
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const listItems: string[] = [];
    const regularLines: string[] = [];

    for (const line of lines) {
      // Matches "1. ", "1) ", "- ", "* ", "• "
      const listMatch = line.match(/^(?:(?:\d+[\.\)])|[-*•])\s+(.+)$/);
      if (listMatch) {
        listItems.push(listMatch[1].trim());
      } else {
        regularLines.push(line);
      }
    }

    if (listItems.length > 0) {
      return listItems;
    }

    // Otherwise split by sentence punctuation (. ! ?) or semicolons
    const fullText = regularLines.join(" ");
    // Split on terminal punctuation followed by whitespace or end of string
    const sentenceSplit = fullText
      .split(/(?<=[.!?])\s+(?=[A-Z0-9`"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    return sentenceSplit.length > 0 ? sentenceSplit : [text];
  }

  /**
   * Removes fluff prefixes and normalizes internal whitespace
   */
  private cleanClaimText(text: string): string {
    let cleaned = text.trim();

    for (const prefix of this.FLUFF_PREFIXES) {
      cleaned = cleaned.replace(prefix, "").trim();
    }

    // Capitalize first letter if needed
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  }

  /**
   * Identifies if a sentence is purely a syntactic tautology with no historical rationale
   */
  private isTrivialSyntaxRestatement(text: string): boolean {
    const lower = text.toLowerCase();
    // E.g. "This function returns a boolean", "This variable is a string"
    if (
      lower.startsWith("this function returns") ||
      lower.startsWith("this function takes") ||
      lower.startsWith("it takes an argument") ||
      lower === "this code works." ||
      lower === "this function is implemented in typescript."
    ) {
      return true;
    }
    return false;
  }

  /**
   * Extracts referenced code symbols (backtick quoted tokens or common identifier patterns)
   */
  private extractSymbol(
    text: string,
    codeSnippet?: string,
  ): string | undefined {
    // 1. Look for backticked symbol in text: `myFunction`
    const backtickMatch = text.match(/`([a-zA-Z0-9_$]+)`/);
    if (backtickMatch) {
      return backtickMatch[1];
    }

    // 2. Look for identifier keywords: function name, class Name
    const identifierMatch = text.match(
      /\b(?:function|class|method|const|let|var|type|interface)\s+([a-zA-Z0-9_$]+)\b/,
    );
    if (identifierMatch) {
      return identifierMatch[1];
    }

    // 3. Fallback: inspect snippet for first function or class declaration
    if (codeSnippet) {
      const snippetMatch = codeSnippet.match(
        /\b(?:function|class|interface|type)\s+([a-zA-Z0-9_$]+)\b/,
      );
      if (snippetMatch) {
        return snippetMatch[1];
      }
    }

    return undefined;
  }
}
