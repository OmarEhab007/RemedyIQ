export type TokenType =
  | "field"
  | "operator"
  | "value-string"
  | "value-number"
  | "keyword"
  | "wildcard"
  | "error"
  | "plain";

export interface Token {
  text: string;
  type: TokenType;
  start: number;
  end: number;
}

const KEYWORDS = ["AND", "OR", "NOT"];
const KNOWN_FIELDS = [
  "type", "log_type", "user", "form", "queue", "thread", "thread_id",
  "trace", "trace_id", "rpc", "rpc_id", "duration", "duration_ms",
  "status", "success", "api_code", "sql_table", "filter", "filter_name",
  "escalation", "esc_name", "timestamp", "error", "error_message",
  "identifier", "line_number", "operation", "request_id",
];

export function tokenizeKQL(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  function isWhitespace(c: string): boolean {
    return /\s/.test(c);
  }

  function isDigit(c: string): boolean {
    return /\d/.test(c);
  }

  function isAlpha(c: string): boolean {
    return /[a-zA-Z_]/.test(c);
  }

  function isAlphaNumeric(c: string): boolean {
    return /[a-zA-Z0-9_]/.test(c);
  }

  function peek(offset: number = 0): string {
    return input[pos + offset] || "";
  }

  function advance(): string {
    return input[pos++];
  }

  function skipWhitespace(): void {
    while (pos < input.length && isWhitespace(peek())) {
      advance();
    }
  }

  function readQuotedString(quote: string): string {
    let str = "";
    advance();
    while (pos < input.length && peek() !== quote) {
      if (peek() === "\\" && peek(1) === quote) {
        advance();
      }
      str += advance();
    }
    if (peek() === quote) {
      advance();
    }
    return str;
  }

  function readWord(): string {
    let word = "";
    while (pos < input.length) {
      const c = peek();
      if (isAlphaNumeric(c) || c === "_" || c === "-" || c === ".") {
        word += advance();
      } else {
        break;
      }
    }
    return word;
  }

  function readNumber(): string {
    let num = "";
    while (pos < input.length && (isDigit(peek()) || peek() === ".")) {
      num += advance();
    }
    return num;
  }

  while (pos < input.length) {
    skipWhitespace();
    if (pos >= input.length) break;

    const startPos = pos;
    const c = peek();

    if (c === '"' || c === "'") {
      const str = readQuotedString(c);
      tokens.push({
        text: c + str + (input[pos - 1] === c ? c : ""),
        type: "value-string",
        start: startPos,
        end: pos,
      });
      continue;
    }

    if (peek() === ">" && peek(1) === "=") {
      advance();
      advance();
      tokens.push({ text: ">=", type: "operator", start: startPos, end: pos });
      continue;
    }
    if (peek() === "<" && peek(1) === "=") {
      advance();
      advance();
      tokens.push({ text: "<=", type: "operator", start: startPos, end: pos });
      continue;
    }
    if (c === ">" || c === "<") {
      advance();
      tokens.push({ text: c, type: "operator", start: startPos, end: pos });
      continue;
    }

    if (c === ":") {
      advance();
      tokens.push({ text: ":", type: "operator", start: startPos, end: pos });
      continue;
    }

    if (c === "(" || c === ")") {
      advance();
      tokens.push({ text: c, type: "operator", start: startPos, end: pos });
      continue;
    }

    if (c === "*") {
      advance();
      tokens.push({ text: "*", type: "wildcard", start: startPos, end: pos });
      continue;
    }

    if (isDigit(c) || (c === "-" && isDigit(peek(1)))) {
      const num = readNumber();
      tokens.push({ text: num, type: "value-number", start: startPos, end: pos });
      continue;
    }

    if (isAlpha(c) || c === "_") {
      const word = readWord();
      const upperWord = word.toUpperCase();

      if (KEYWORDS.includes(upperWord)) {
        tokens.push({ text: word, type: "keyword", start: startPos, end: pos });
      } else if (KNOWN_FIELDS.includes(word.toLowerCase())) {
        tokens.push({ text: word, type: "field", start: startPos, end: pos });
      } else {
        tokens.push({ text: word, type: "plain", start: startPos, end: pos });
      }
      continue;
    }

    advance();
    tokens.push({ text: c, type: "plain", start: startPos, end: pos });
  }

  return mergeTokens(tokens);
}

function mergeTokens(tokens: Token[]): Token[] {
  if (tokens.length === 0) return tokens;

  const merged: Token[] = [tokens[0]];

  for (let i = 1; i < tokens.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = tokens[i];

    if (prev.type === "field" && curr.type === "operator" && curr.text === ":") {
      merged.push(curr);
    } else if (
      prev.type === "operator" &&
      prev.text === ":" &&
      (curr.type === "value-string" || curr.type === "value-number" || curr.type === "wildcard" || curr.type === "plain")
    ) {
      const valueToken: Token = {
        text: curr.text,
        type: curr.type === "wildcard" ? "wildcard" : 
              curr.type === "value-number" ? "value-number" : 
              curr.type === "value-string" ? "value-string" : "value-string",
        start: curr.start,
        end: curr.end,
      };
      merged.push(valueToken);
    } else if (
      prev.type === "operator" &&
      (prev.text === ">" || prev.text === "<" || prev.text === ">=" || prev.text === "<=") &&
      curr.type === "value-number"
    ) {
      merged.push(curr);
    } else if (prev.type === "plain" && curr.type === "plain" && prev.end === curr.start) {
      prev.text += curr.text;
      prev.end = curr.end;
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

export function highlightKQL(input: string): Array<{ text: string; type: TokenType }> {
  const tokens = tokenizeKQL(input);
  const result: Array<{ text: string; type: TokenType }> = [];
  let lastEnd = 0;

  for (const token of tokens) {
    if (token.start > lastEnd) {
      result.push({
        text: input.substring(lastEnd, token.start),
        type: "plain",
      });
    }
    result.push({ text: token.text, type: token.type });
    lastEnd = token.end;
  }

  if (lastEnd < input.length) {
    result.push({
      text: input.substring(lastEnd),
      type: "plain",
    });
  }

  return result;
}
