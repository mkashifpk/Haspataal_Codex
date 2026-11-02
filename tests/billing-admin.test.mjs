import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getBillingAdminCapabilityView,
  validateServiceInput,
  validateServicePatch,
  validatePanelInput,
  validatePanelDiscountInput,
  validateDiscountPolicyInput,
  validateContractInput,
  BILLING_ADMIN_ERROR_MESSAGES,
  SERVICE_CATEGORIES,
  PANEL_TYPES,
  CONTRACT_RULE_TYPES,
} from '../src/billing-admin-policy.ts';

describe('billing_admin: Domain Policy & Business Rules (Screen 134)', () => {
  describe('Capability View Resolution', () => {
    it('defaults to full when establishment is undefined or missing views', () => {
      assert.equal(getBillingAdminCapabilityView(undefined), 'full');
      assert.equal(getBillingAdminCapabilityView(null), 'full');
      assert.equal(getBillingAdminCapabilityView({}), 'full');
    });

    it('resolves views when screens is an array', () => {
      const estArray = {
        views: {
          screens: [
            { screen_id: 'billing_admin', view: 'setup' },
            { screen_id: 'other', view: 'records' },
          ],
        },
      };
      assert.equal(getBillingAdminCapabilityView(estArray), 'setup');
    });

    it('resolves views when screens is an object dictionary', () => {
      const estObj = {
        views: {
          screens: {
            billing_admin: { view: 'open_work' },
          },
        },
      };
      assert.equal(getBillingAdminCapabilityView(estObj), 'open_work');
    });
  });

  describe('Service Catalogue & Price Rules (rule:55973e6dbd)', () => {
    it('validates mandatory fields and non-negative default price', () => {
      const missingCode = validateServiceInput({ code: '', name: 'Consultation', category: 'OPD', default_price: 1500 });
      assert.equal(missingCode.valid, false);
      assert.match(missingCode.error || '', /code is required/i);

      const missingName = validateServiceInput({ code: 'OPD-GEN', name: '', category: 'OPD', default_price: 1500 });
      assert.equal(missingName.valid, false);
      assert.match(missingName.error || '', /name is required/i);

      const invalidCategory = validateServiceInput({ code: 'OPD-GEN', name: 'General', category: 'InvalidCat', default_price: 1500 });
      assert.equal(invalidCategory.valid, false);
      assert.match(invalidCategory.error || '', /valid service category/i);

      const negativePrice = validateServiceInput({ code: 'OPD-GEN', name: 'General', category: 'OPD', default_price: -50 });
      assert.equal(negativePrice.valid, false);
      assert.match(negativePrice.error || '', /non-negative number/i);

      const validService = validateServiceInput({ code: 'OPD-GEN', name: 'General OPD', category: 'OPD', default_price: 1000 });
      assert.equal(validService.valid, true);
    });

    it('validates service price patch under rule:55973e6dbd', () => {
      const invalidName = validateServicePatch({ name: '   ' });
      assert.equal(invalidName.valid, false);
      assert.match(invalidName.error || '', /name cannot be empty/i);

      const negativePrice = validateServicePatch({ default_price: -100 });
      assert.equal(negativePrice.valid, false);
      assert.match(negativePrice.error || '', /non-negative/i);

      const validPatch = validateServicePatch({ default_price: 1200, is_active: true });
      assert.equal(validPatch.valid, true);
    });
  });

  describe('Panels & Discount Rules', () => {
    it('validates panel input structure and baseline discount', () => {
      const missingCode = validatePanelInput({ code: '', name: 'State Life', panel_type: 'Corporate' });
      assert.equal(missingCode.valid, false);

      const invalidType = validatePanelInput({ code: 'SL-01', name: 'State Life', panel_type: 'WrongType' });
      assert.equal(invalidType.valid, false);

      const invalidPct = validatePanelInput({ code: 'SL-01', name: 'State Life', panel_type: 'Corporate', discount_pct: 120 });
      assert.equal(invalidPct.valid, false);

      const validPanel = validatePanelInput({ code: 'SS-01', name: 'Sehat Sahulat Program', panel_type: 'SehatSahulat', discount_pct: 100, is_credit_panel: true });
      assert.equal(validPanel.valid, true);
    });

    it('validates panel temporal discount rules', () => {
      const missingPanel = validatePanelDiscountInput({ panel_id: 0, discount_pct: 20, effective_from: '2026-11-01' });
      assert.equal(missingPanel.valid, false);

      const invalidPct = validatePanelDiscountInput({ panel_id: 1, discount_pct: -5, effective_from: '2026-11-01' });
      assert.equal(invalidPct.valid, false);

      const invertedDates = validatePanelDiscountInput({
        panel_id: 1,
        discount_pct: 20,
        effective_from: '2026-11-10',
        effective_to: '2026-11-01',
      });
      assert.equal(invertedDates.valid, false);
      assert.match(invertedDates.error || '', /cannot precede/i);

      const validDiscount = validatePanelDiscountInput({
        panel_id: 1,
        discount_pct: 25,
        effective_from: '2026-11-01',
        effective_to: '2026-12-31',
      });
      assert.equal(validDiscount.valid, true);
    });
  });

  describe('Discount Ceiling Policies', () => {
    it('requires either role_code or user_id and bounds percentages', () => {
      const missingTarget = validateDiscountPolicyInput({ max_discount_pct: 20 });
      assert.equal(missingTarget.valid, false);
      assert.match(missingTarget.error || '', /either a target role code or user id is required/i);

      const outOfBounds = validateDiscountPolicyInput({ role_code: 'cashier', max_discount_pct: 105 });
      assert.equal(outOfBounds.valid, false);

      const negativeAmt = validateDiscountPolicyInput({ role_code: 'cashier', max_discount_pct: 15, max_discount_amount: -500 });
      assert.equal(negativeAmt.valid, false);

      const validPolicy = validateDiscountPolicyInput({ role_code: 'cashier', max_discount_pct: 10, max_discount_amount: 5000 });
      assert.equal(validPolicy.valid, true);
    });
  });

  describe('Consultant Commission Contracts', () => {
    it('validates FixedFee commission model requiring positive amount', () => {
      const zeroFee = validateContractInput({
        employee_id: 5,
        rule_type: 'FixedFee',
        amount: 0,
        effective_from: '2026-11-01',
      });
      assert.equal(zeroFee.valid, false);
      assert.match(zeroFee.error || '', /greater than zero/i);

      const validFee = validateContractInput({
        employee_id: 5,
        rule_type: 'FixedFee',
        amount: 25000,
        effective_from: '2026-11-01',
      });
      assert.equal(validFee.valid, true);
    });

    it('validates PercentGross and PercentNet commission models requiring percentage 0.1-100', () => {
      const zeroPct = validateContractInput({
        employee_id: 5,
        rule_type: 'PercentGross',
        percentage: 0,
        effective_from: '2026-11-01',
      });
      assert.equal(zeroPct.valid, false);
      assert.match(zeroPct.error || '', /between 0.1% and 100%/i);

      const overPct = validateContractInput({
        employee_id: 5,
        rule_type: 'PercentNet',
        percentage: 120,
        effective_from: '2026-11-01',
      });
      assert.equal(overPct.valid, false);

      const validGross = validateContractInput({
        employee_id: 5,
        rule_type: 'PercentGross',
        percentage: 60,
        effective_from: '2026-11-01',
      });
      assert.equal(validGross.valid, true);

      const validNet = validateContractInput({
        employee_id: 5,
        rule_type: 'PercentNet',
        percentage: 75,
        effective_from: '2026-11-01',
      });
      assert.equal(validNet.valid, true);
    });

    it('validates inverted effective dates on contracts', () => {
      const inverted = validateContractInput({
        employee_id: 5,
        rule_type: 'FixedFee',
        amount: 10000,
        effective_from: '2026-12-01',
        effective_to: '2026-11-01',
      });
      assert.equal(inverted.valid, false);
      assert.match(inverted.error || '', /cannot precede/i);
    });
  });

  describe('Error Messages & Enums', () => {
    it('covers all standard error codes with English and Urdu explanations', () => {
      const requiredCodes = [
        'NOT_FOUND',
        'REFERENCE_NOT_FOUND',
        'TEMPORAL_OVERLAP',
        'UNAUTHENTICATED',
        'VALIDATION_ERROR',
        'VERSION_CONFLICT',
      ];
      for (const code of requiredCodes) {
        assert.ok(BILLING_ADMIN_ERROR_MESSAGES[code], `Missing error translation for ${code}`);
        assert.ok(BILLING_ADMIN_ERROR_MESSAGES[code].en.length > 0);
        assert.ok(BILLING_ADMIN_ERROR_MESSAGES[code].ur.length > 0);
      }
    });

    it('exports all standard category, panel, and contract enum lists', () => {
      assert.ok(SERVICE_CATEGORIES.includes('OPD'));
      assert.ok(SERVICE_CATEGORIES.includes('OT'));
      assert.ok(PANEL_TYPES.includes('SehatSahulat'));
      assert.ok(PANEL_TYPES.includes('Corporate'));
      assert.ok(CONTRACT_RULE_TYPES.includes('FixedFee'));
      assert.ok(CONTRACT_RULE_TYPES.includes('PercentGross'));
      assert.ok(CONTRACT_RULE_TYPES.includes('PercentNet'));
    });
  });
});
