import crypto from "node:crypto";

const SECRET_PATTERNS = [
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9_-]{20,}/g },
  { name: "GitHub Personal Access Token", regex: /gh[pousr]-[A-Za-z0-9_]{36,}/g },
  { name: "AWS Key", regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  { name: "Private Key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[a-zA-Z0-9+/\s=]+-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "JWT Token", regex: /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g },
  { name: "Bearer Token", regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi }
];

export class SecretVault {
  // Mapping of placeholder -> real secret
  private tokenToSecret = new Map<string, string>();
  // Mapping of real secret -> placeholder
  private secretToToken = new Map<string, string>();

  /**
   * Sanitizes input strings by storing actual credentials in an in-memory vault
   * and replacing them with reversible placeholder tokens (e.g. [[MCP_SHIELD_REF_xxxx]]).
   */
  public tokenizeString(text: string): { sanitizedText: string; count: number } {
    let sanitized = text;
    let count = 0;

    for (const { regex } of SECRET_PATTERNS) {
      regex.lastIndex = 0;
      sanitized = sanitized.replace(regex, (match) => {
        count++;
        if (this.secretToToken.has(match)) {
          return this.secretToToken.get(match)!;
        }

        const id = crypto.randomBytes(4).toString("hex");
        const placeholder = `[[MCP_SHIELD_REF_${id}]]`;
        this.tokenToSecret.set(placeholder, match);
        this.secretToToken.set(match, placeholder);
        return placeholder;
      });
    }

    return { sanitizedText: sanitized, count };
  }

  /**
   * Re-hydrates placeholders with the real secrets before sending to downstream services.
   */
  public detokenizeString(text: string): string {
    let restored = text;
    for (const [placeholder, originalSecret] of this.tokenToSecret.entries()) {
      if (restored.includes(placeholder)) {
        restored = restored.replaceAll(placeholder, originalSecret);
      }
    }
    return restored;
  }

  public tokenizeObject(obj: any): { sanitizedObj: any; count: number } {
    let totalCount = 0;

    const deepTokenize = (target: any): any => {
      if (typeof target === "string") {
        const { sanitizedText, count } = this.tokenizeString(target);
        totalCount += count;
        return sanitizedText;
      }
      if (Array.isArray(target)) {
        return target.map(deepTokenize);
      }
      if (target !== null && typeof target === "object") {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(target)) {
          const lower = k.toLowerCase();
          if (["password", "secret", "token", "apikey", "api_key", "private_key"].includes(lower) && typeof v === "string") {
            const id = crypto.randomBytes(4).toString("hex");
            const placeholder = `[[MCP_SHIELD_REF_${id}]]`;
            this.tokenToSecret.set(placeholder, v);
            this.secretToToken.set(v, placeholder);
            out[k] = placeholder;
            totalCount++;
          } else {
            out[k] = deepTokenize(v);
          }
        }
        return out;
      }
      return target;
    };

    const sanitizedObj = deepTokenize(obj);
    return { sanitizedObj, count: totalCount };
  }

  public detokenizeObject(obj: any): any {
    const deepDetokenize = (target: any): any => {
      if (typeof target === "string") {
        return this.detokenizeString(target);
      }
      if (Array.isArray(target)) {
        return target.map(deepDetokenize);
      }
      if (target !== null && typeof target === "object") {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(target)) {
          out[k] = deepDetokenize(v);
        }
        return out;
      }
      return target;
    };

    return deepDetokenize(obj);
  }
}
