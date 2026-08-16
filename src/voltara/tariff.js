'use strict';

const crypto = require('node:crypto');

function assertNonNegative(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new TypeError(`${name} must be a finite non-negative number`);
  }
  return n;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function quoteEnergyCost({
  unitsKwh,
  energyRate,
  fixedCharge = 0,
  taxRate = 0,
  fuelAdjustmentPerKwh = 0,
  subsidyPerKwh = 0,
  currency = 'PKR',
} = {}) {
  const units = assertNonNegative(unitsKwh, 'unitsKwh');
  const rate = assertNonNegative(energyRate, 'energyRate');
  const fixed = assertNonNegative(fixedCharge, 'fixedCharge');
  const tax = assertNonNegative(taxRate, 'taxRate');
  const fuel = assertNonNegative(fuelAdjustmentPerKwh, 'fuelAdjustmentPerKwh');
  const subsidy = assertNonNegative(subsidyPerKwh, 'subsidyPerKwh');
  if (tax > 1) throw new RangeError('taxRate must be between 0 and 1');

  const energy = units * rate;
  const fuelAdjustment = units * fuel;
  const subsidyAmount = Math.min(energy + fuelAdjustment, units * subsidy);
  const taxable = Math.max(0, energy + fuelAdjustment - subsidyAmount + fixed);
  const taxAmount = taxable * tax;
  const total = taxable + taxAmount;

  const result = {
    currency: String(currency || 'PKR'),
    unitsKwh: units,
    energyCharge: Number(energy.toFixed(2)),
    fuelAdjustment: Number(fuelAdjustment.toFixed(2)),
    subsidy: Number(subsidyAmount.toFixed(2)),
    fixedCharge: Number(fixed.toFixed(2)),
    tax: Number(taxAmount.toFixed(2)),
    total: Number(total.toFixed(2)),
    effectiveRatePerKwh: units === 0 ? 0 : Number((total / units).toFixed(4)),
  };

  const canonical = stableJson(result);
  return Object.freeze({
    ...result,
    quoteId: crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 24),
  });
}

function compareTariffs(input, tariffs) {
  if (!Array.isArray(tariffs) || tariffs.length === 0) {
    throw new TypeError('tariffs must be a non-empty array');
  }

  return tariffs.map((tariff) => {
    if (!tariff || typeof tariff !== 'object' || !String(tariff.name || '').trim()) {
      throw new TypeError('each tariff requires a name');
    }
    return {
      name: String(tariff.name).trim(),
      quote: quoteEnergyCost({ ...input, ...tariff }),
    };
  }).sort((a, b) => a.quote.total - b.quote.total || a.name.localeCompare(b.name));
}

module.exports = { quoteEnergyCost, compareTariffs, stableJson };
