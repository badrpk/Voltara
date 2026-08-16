'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { quoteEnergyCost, compareTariffs } = require('../src/voltara/tariff');

test('quote is deterministic for identical inputs', () => {
  const input = { unitsKwh: 200, energyRate: 40, fixedCharge: 500, taxRate: 0.18 };
  assert.deepEqual(quoteEnergyCost(input), quoteEnergyCost(input));
});

test('zero usage keeps effective rate at zero', () => {
  const quote = quoteEnergyCost({ unitsKwh: 0, energyRate: 40, fixedCharge: 0 });
  assert.equal(quote.total, 0);
  assert.equal(quote.effectiveRatePerKwh, 0);
});

test('fuel adjustment subsidy fixed charge and tax are itemized', () => {
  const quote = quoteEnergyCost({
    unitsKwh: 100,
    energyRate: 30,
    fuelAdjustmentPerKwh: 5,
    subsidyPerKwh: 2,
    fixedCharge: 100,
    taxRate: 0.1,
  });
  assert.equal(quote.energyCharge, 3000);
  assert.equal(quote.fuelAdjustment, 500);
  assert.equal(quote.subsidy, 200);
  assert.equal(quote.fixedCharge, 100);
  assert.equal(quote.tax, 340);
  assert.equal(quote.total, 3740);
});

test('comparison ranks the lowest total first and is deterministic', () => {
  const tariffs = [
    { name: 'B', energyRate: 35 },
    { name: 'A', energyRate: 30 },
  ];
  const result = compareTariffs({ unitsKwh: 100 }, tariffs);
  assert.deepEqual(result.map((x) => x.name), ['A', 'B']);
  assert.deepEqual(result, compareTariffs({ unitsKwh: 100 }, tariffs));
});

test('equal totals use tariff name as deterministic tie break', () => {
  const result = compareTariffs({ unitsKwh: 10 }, [
    { name: 'Zulu', energyRate: 20 },
    { name: 'Alpha', energyRate: 20 },
  ]);
  assert.deepEqual(result.map((x) => x.name), ['Alpha', 'Zulu']);
});

test('invalid numeric values and tax rates are rejected', () => {
  assert.throws(() => quoteEnergyCost({ unitsKwh: -1, energyRate: 40 }), /unitsKwh/);
  assert.throws(() => quoteEnergyCost({ unitsKwh: 1, energyRate: -1 }), /energyRate/);
  assert.throws(() => quoteEnergyCost({ unitsKwh: 1, energyRate: 1, taxRate: 1.1 }), /taxRate/);
});

test('comparison requires named tariffs', () => {
  assert.throws(() => compareTariffs({ unitsKwh: 1 }, []), /non-empty/);
  assert.throws(() => compareTariffs({ unitsKwh: 1 }, [{ energyRate: 20 }]), /name/);
});
