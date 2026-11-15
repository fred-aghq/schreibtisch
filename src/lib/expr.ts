/**
 * Tiny arithmetic evaluator for numeric input fields: + − * / parentheses, decimals,
 * unary minus. Returns null for anything it can't parse (never uses eval).
 */
export function evaluateExpression(input: string): number | null {
  const src = input.replace(/,/g, '.').replace(/\s+/g, '').replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-');
  if (src.length === 0) return null;
  let i = 0;

  const peek = (): string | undefined => src[i];

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = src[i++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = src[i++];
      const right = parseFactor();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number | null {
    const c = peek();
    if (c === '-') {
      i++;
      const v = parseFactor();
      return v === null ? null : -v;
    }
    if (c === '+') {
      i++;
      return parseFactor();
    }
    if (c === '(') {
      i++;
      const v = parseExpr();
      if (v === null || peek() !== ')') return null;
      i++;
      return v;
    }
    const m = /^\d*\.?\d+(?:e[+-]?\d+)?|^\d+\./i.exec(src.slice(i));
    if (!m) return null;
    i += m[0].length;
    return Number(m[0]);
  }

  const result = parseExpr();
  if (result === null || i !== src.length || !Number.isFinite(result)) return null;
  return result;
}
