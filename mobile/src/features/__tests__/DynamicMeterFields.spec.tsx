import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DynamicMeterFields } from '../tasks/DynamicMeterFields';
import type { MeterTypeFieldItem } from '@/api/meter-type-definitions.api';
import { useI18nStore } from '@/i18n/i18n.store';

const sampleFields: MeterTypeFieldItem[] = [
  {
    id: 'f-2',
    meterTypeDefinitionId: 'mtd-1',
    name: 'sealCode',
    label: 'Broj plombe',
    fieldType: 'STRING',
    isRequired: true,
    isOperatorFillable: true,
    sortOrder: 2,
    defaultValue: null,
  },
  {
    id: 'f-1',
    meterTypeDefinitionId: 'mtd-1',
    name: 'hasExternalAntenna',
    label: 'Vanjska antena',
    fieldType: 'BOOLEAN',
    isRequired: false,
    isOperatorFillable: true,
    sortOrder: 1,
    defaultValue: null,
  },
  {
    id: 'f-3',
    meterTypeDefinitionId: 'mtd-1',
    name: 'firmware',
    label: 'Firmware',
    fieldType: 'STRING',
    isRequired: false,
    isOperatorFillable: false,
    sortOrder: 3,
    defaultValue: 'v4.2',
  },
];

describe('DynamicMeterFields', () => {
  beforeEach(async () => {
    await useI18nStore.getState().setLanguage('bs');
  });

  it('renders fillable text/boolean fields, readonly values, and emits changes', async () => {
    const onChange = jest.fn();

    await render(
      <DynamicMeterFields
        fields={sampleFields}
        values={{ sealCode: 'PL-100', hasExternalAntenna: false }}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Dodatna polja brojila')).toBeTruthy();
    expect(screen.getByText('Firmware')).toBeTruthy();
    expect(screen.getByText('v4.2')).toBeTruthy();

    await fireEvent.changeText(
      screen.getByTestId('dynamic-field-input-sealCode'),
      'PL-200',
    );
    expect(onChange).toHaveBeenCalledWith('sealCode', 'PL-200');

    await fireEvent(
      screen.getByTestId('dynamic-field-switch-hasExternalAntenna'),
      'valueChange',
      true,
    );
    expect(onChange).toHaveBeenCalledWith('hasExternalAntenna', true);
  });

  it('renders localized error message in English when error prop is true', async () => {
    await useI18nStore.getState().setLanguage('en');

    await render(
      <DynamicMeterFields
        fields={[]}
        values={{}}
        onChange={jest.fn()}
        error={true}
      />,
    );

    expect(
      screen.getByText('Could not load extra fields for this meter type.'),
    ).toBeTruthy();
  });
});
