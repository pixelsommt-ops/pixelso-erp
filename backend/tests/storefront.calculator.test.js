const { calculatePrintPrice } = require('../src/modules/storefront/storefront.calculator');

describe('calculatePrintPrice - qty tiers', () => {
  const tieredChoice = {
    id: 1,
    label: 'Stiker HVS',
    priceMode: 'replace_base',
    priceValue: 9000,
    isDefault: true,
    qtyTiers: [
      { minQty: 1, maxQty: 100, price: 9000 },
      { minQty: 101, maxQty: 200, price: 8850 },
      { minQty: 201, maxQty: null, price: 8600 },
    ],
  };

  const config = {
    designFee: 0,
    products: [
      {
        key: 'test-tiered',
        active: true,
        mode: 'unit',
        baseRate: 9000,
        minArea: 0,
        setup: 0,
        optionGroups: [{ id: 1, label: 'Bahan', required: true, choices: [tieredChoice] }],
      },
    ],
  };

  test('uses the tier matching a low quantity', () => {
    const result = calculatePrintPrice(config, { productKey: 'test-tiered', quantity: 50, selections: { 1: 1 } });
    expect(result.valid).toBe(true);
    expect(result.base).toBe(9000 * 50);
  });

  test('uses the tier matching a mid-range quantity', () => {
    const result = calculatePrintPrice(config, { productKey: 'test-tiered', quantity: 150, selections: { 1: 1 } });
    expect(result.base).toBe(8850 * 150);
  });

  test('uses the open-ended top tier for a quantity above all maxQty', () => {
    const result = calculatePrintPrice(config, { productKey: 'test-tiered', quantity: 500, selections: { 1: 1 } });
    expect(result.base).toBe(8600 * 500);
  });

  test('choices without qtyTiers fall back to flat priceValue', () => {
    const flatConfig = {
      ...config,
      products: [
        {
          ...config.products[0],
          optionGroups: [
            { id: 1, label: 'Bahan', required: true, choices: [{ id: 2, label: 'Stiker Gold', priceMode: 'replace_base', priceValue: 22000, isDefault: true }] },
          ],
        },
      ],
    };
    const result = calculatePrintPrice(flatConfig, { productKey: 'test-tiered', quantity: 3, selections: { 1: 2 } });
    expect(result.base).toBe(22000 * 3);
  });
});
