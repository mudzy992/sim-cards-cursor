import { BadRequestException } from '@nestjs/common';

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

const assertIntegerYear = (value: number, fieldLabel: string): void => {
  if (!Number.isInteger(value) || value < MIN_YEAR || value > MAX_YEAR) {
    throw new BadRequestException(
      `${fieldLabel} mora biti cijeli broj između ${MIN_YEAR} i ${MAX_YEAR}.`,
    );
  }
};

/**
 * Obavezne godine proizvodnje i baždarenja pri kreiranju brojila kroz zapisnik ili admin unos.
 */
export const assertMeterYearsRequired = (
  year: number | null | undefined,
  calibrationYear: number | null | undefined,
  contextLabel = 'brojilo',
): void => {
  if (year == null || calibrationYear == null) {
    throw new BadRequestException(
      `Godina proizvodnje i godina baždarenja su obavezne za ${contextLabel}.`,
    );
  }
  assertIntegerYear(year, 'Godina proizvodnje');
  assertIntegerYear(calibrationYear, 'Godina baždarenja');
};

/**
 * Pri izmjeni brojila: ako je jedna godina postavljena, obje moraju biti postavljene (nakon merge-a).
 */
export const assertMeterYearsPairIfPartial = (
  year: number | null | undefined,
  calibrationYear: number | null | undefined,
): void => {
  const hasY = year != null;
  const hasC = calibrationYear != null;
  if (hasY !== hasC) {
    throw new BadRequestException(
      'Godina proizvodnje i godina baždarenja moraju biti unijete zajedno.',
    );
  }
  if (hasY) {
    assertIntegerYear(year as number, 'Godina proizvodnje');
    assertIntegerYear(calibrationYear as number, 'Godina baždarenja');
  }
};
