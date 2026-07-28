import { describe, expect, it } from 'vitest';
import {
  assessFamilyReference,
  leadingPrintedVerseNumber,
  printedVerseBoundaryNumbers,
} from '../../scripts/lib/fax-family-reference-qa.ts';

const suffix = (index: number): string => {
  let value = index;
  let output = '';
  do {
    output = String.fromCharCode(97 + value % 26) + output;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return output;
};

const words = (count: number, prefix = 'word'): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${suffix(index)}`).join(' ');

describe('family reference QA', () => {
  it('accepts a near-exact derivative crop despite canonical-only flags', () => {
    const reference = words(30);
    const target = `${reference} noise`;
    const result = assessFamilyReference({
      referenceOcr: reference,
      referenceFlags: ['canonical-trailing-token-missing'],
      targetOcr: target,
      targetFlags: ['canonical-trailing-token-missing'],
    });
    expect(result.accepted).toBe(true);
    expect(result.tier).toBe('strong-ocr-equivalence');
  });

  it('rejects a crop that includes substantial following-verse text', () => {
    const reference = words(50);
    const target = `${reference} ${words(12, 'next')}`;
    const result = assessFamilyReference({
      referenceOcr: reference,
      targetOcr: target,
      targetFlags: ['following-content-after-verse'],
    });
    expect(result.accepted).toBe(false);
    expect(result.alignment.sequence.ocrPrecision).toBeLessThan(0.92);
  });

  it('rejects a wrong scan leaf', () => {
    const result = assessFamilyReference({
      referenceOcr: words(25, 'mosiah'),
      targetOcr: words(25, 'alma'),
    });
    expect(result.accepted).toBe(false);
    expect(result.alignment.sequence.canonicalCoverage).toBe(0);
  });

  it('accepts short noisy text only with strong page registration', () => {
    const reference =
      'And whosoever has committed iniquity him have puntehee according ' +
      'to the law which has been given to u y our fathers';
    const target =
      'And whosoever has committed iniquity him have I punished according ' +
      'to the law which has been given to us by our fathers';
    const withoutRegistration = assessFamilyReference({
      referenceOcr: reference,
      targetOcr: target,
    });
    const withRegistration = assessFamilyReference({
      referenceOcr: reference,
      targetOcr: target,
      registrations: [{
        accepted: true,
        sourceCoverage: 0.93,
        targetCoverage: 0.94,
      }],
    });
    expect(withoutRegistration.accepted).toBe(false);
    expect(withRegistration.accepted).toBe(true);
    expect(withRegistration.tier).toBe('registered-short-text');
  });

  it('does not trust a reference crop with content outside the verse', () => {
    const result = assessFamilyReference({
      referenceOcr: words(30),
      referenceFlags: ['following-content-after-verse'],
      targetOcr: words(30),
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('unsafe reference evidence');
  });

  it('does not waive explicit adjacent-verse leakage on the target', () => {
    const reference = words(30);
    const result = assessFamilyReference({
      referenceOcr: reference,
      targetOcr: reference,
      targetFlags: ['following-neighbor-text-leak'],
    });
    expect(result.accepted).toBe(false);
    expect(result.reason).toContain('unsafe target evidence');
  });

  it('hard-rejects an explicit neighboring printed verse number', () => {
    const result = assessFamilyReference({
      referenceOcr: '18. And it came to pass that I saw them',
      targetOcr: '16. And it came to pass that they did come unto me',
      expectedLeadingNumber: 18,
      registrations: [{
        accepted: true,
        sourceCoverage: 0.95,
        targetCoverage: 0.95,
      }],
    });
    expect(result.accepted).toBe(false);
    expect(result.leadingNumberMismatch).toBe(true);
    expect(result.reason).toContain('reference=18, target=16');
  });

  it('does not hard-reject a source OCR digit confusion', () => {
    const result = assessFamilyReference({
      referenceOcr: '93. And it came to pass that I saw them',
      targetOcr: '23. And it came to pass that I saw them',
      expectedLeadingNumber: 23,
    });
    expect(result.leadingNumberDisagreement).toBe(true);
    expect(result.leadingNumberMismatch).toBe(false);
  });

  it('does not hard-reject a distant target OCR digit confusion', () => {
    const result = assessFamilyReference({
      referenceOcr: '30. And it came to pass that I saw them',
      targetOcr: '80. And it came to pass that I saw them',
      expectedLeadingNumber: 30,
    });
    expect(result.leadingNumberDisagreement).toBe(true);
    expect(result.leadingNumberMismatch).toBe(false);
  });

  it('does not hard-reject a nearby digit confusion when words match', () => {
    const result = assessFamilyReference({
      referenceOcr: '23. And it came to pass that I saw them',
      targetOcr: '25. And it came to pass that I saw them',
      expectedLeadingNumber: 23,
    });
    expect(result.leadingNumberDisagreement).toBe(true);
    expect(result.leadingNumberMismatch).toBe(false);
    expect(result.accepted).toBe(true);
  });

  it('hard-rejects an adjacent printed verse label in the crop', () => {
    const result = assessFamilyReference({
      referenceOcr: '20. And Corum was the son of Levi',
      targetOcr:
        '19. And Kish was the son of Corum;\n' +
        '20. And Corum was the son of Levi',
      expectedLeadingNumber: 20,
    });
    expect(result.adjacentNumberLeak).toBe(true);
    expect(result.unexpectedBoundaryNumbers).toEqual([19]);
    expect(result.accepted).toBe(false);
  });

  it('reads printed labels only at OCR line boundaries', () => {
    expect(printedVerseBoundaryNumbers(
      '31. And Shule was the son of Kib;\nand in the 30th year he reigned',
    )).toEqual([31]);
  });

  it('detects two adjacent labels when OCR damages the expected digit', () => {
    const result = assessFamilyReference({
      referenceOcr: '20. And Corum was the son of Levi',
      targetOcr:
        '19. And Kish was the son of Corum;\n' +
        '09. And Corum was the son of Levi',
      expectedLeadingNumber: 20,
    });
    expect(result.targetBoundaryNumbers).toEqual([19, 9]);
    expect(result.adjacentNumberLeak).toBe(true);
  });

  it('does not infer a verse number from an incidental interior number', () => {
    expect(leadingPrintedVerseNumber(
      'And it came to pass in the 18th year',
    )).toBeNull();
  });
});
