import { describe, expect, it } from 'vitest';
import { evaluateExpression } from './expr';

describe('evaluateExpression', () => {
  it.each([
    ['300', 300],
    ['300+45', 345],
    ['  1600 / 2 ', 800],
    ['2*(100+50)', 300],
    ['-12.5', -12.5],
    ['10 - -5', 15],
    ['12,5', 12.5],
    ['.5', 0.5],
    ['3x4', 12],
    ['1e3', 1000],
  ])('%s = %d', (input, expected) => {
    expect(evaluateExpression(input)).toBeCloseTo(expected);
  });

  it.each(['', 'abc', '1+', '(1+2', '1/0', '2**3', 'alert(1)'])('rejects %j', (input) => {
    expect(evaluateExpression(input)).toBeNull();
  });
});
