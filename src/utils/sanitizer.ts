const SECRET_PATTERNS = [
  // OpenAI API Key
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9_-]{20,}/g },
  // GitHub Personal Access Token
  { name: "GitHub Token", regex: /gh[pousr]-[A-Za-z0-9_]{36,}/g },
  // AWS Access Key ID
  { name: "AWS Key", regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g },
  // Generic Private Key
  { name: "Private Key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[a-zA-Z0-9+/\s=]+-----END [A-Z ]*PRIVATE KEY-----/g },
  // Generic JWT
  { name: "JWT Token", regex: /ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g },
  // Bearer Token
  { name: "Bearer Token", regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi },
  // Password / Secret in JSON or query params
  { name: "Password field", regex: /"(?:password|passwd|secret|api_key|apikey|auth_token)":\s*"([^"]+)"/gi }
];

export function maskSecretsInString(text: string): { maskedText: string; count: number } {
  let masked = text;
  let count = 0;

  for (const { regex } of SECRET_PATTERNS) {
    // Reset regex index if global
    regex.lastIndex = 0;
    const matches = text.match(regex);
    if (matches) {
      count += matches.length;
      masked = masked.replace(regex, "[REDACTED_SECRET]");
    }
  }

  return { maskedText: masked, count };
}

export function maskSecretsInObject(obj: any): { maskedObj: any; count: number } {
  let count = 0;

  function deepMask(target: any): any {
    if (typeof target === "string") {
      const res = maskSecretsInString(target);
      count += res.count;
      return res.maskedText;
    }
    if (Array.isArray(target)) {
      return target.map(deepMask);
    }
    if (target !== null && typeof target === "object") {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(target)) {
        const lowerKey = k.toLowerCase();
        if (["password", "secret", "token", "apikey", "api_key", "private_key"].includes(lowerKey)) {
          out[k] = "[REDACTED_SECRET]";
          count++;
        } else {
          out[k] = deepMask(v);
        }
      }
      return out;
    }
    return target;
  }

  const maskedObj = deepMask(obj);
  return { maskedObj, count };
}
