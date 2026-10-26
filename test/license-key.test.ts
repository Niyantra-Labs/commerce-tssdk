import { describe, expect, it } from 'vitest';
import { isGeneratedLicenseKeyFormat } from '../src/index.js';

describe('Commerce-generated license key format', () => {
  it('accepts eight uppercase hexadecimal groups', () => {
    expect(isGeneratedLicenseKeyFormat('ABCD-1234-0000-FFFF-9A9A-B0B0-C1C1-D2D2')).toBe(true);
  });

  it.each([
    'abcd-1234-0000-FFFF-9A9A-B0B0-C1C1-D2D2',
    'ABCD-1234',
    'ABCD-1234-0000-FFFF-9A9A-B0B0-C1C1-D2D2-extra',
    'ABCD-1234-0000-FFFF-9A9A-B0B0-C1C1-GGGG',
    '',
  ])('rejects %s', (value) => {
    expect(isGeneratedLicenseKeyFormat(value)).toBe(false);
  });
});
