import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getPharmacyAdminCapabilityView,
  validateDrugInput,
  validateBatchInput,
  validateAdjustInput,
  validateVendorInvoiceInput,
  validateSupplierReturnInput,
  PHARMACY_ADMIN_ERROR_MESSAGES,
  DRUG_FORMS,
  DRUG_SCHEDULES,
  HIGH_ALERT_CATEGORIES,
  ADJUSTMENT_REASONS,
  SUPPLIER_RETURN_REASONS,
  VENDOR_INVOICE_TYPES,
  VENDOR_INVOICE_MODULES,
} from '../src/pharmacy-admin-policy.ts';

describe('pharmacy_admin: Domain Policy & Business Rules (Screen 135)', () => {
  describe('Capability View Resolution', () => {
    it('defaults to full when establishment is undefined or missing views', () => {
      assert.equal(getPharmacyAdminCapabilityView(undefined), 'full');
      assert.equal(getPharmacyAdminCapabilityView(null), 'full');
      assert.equal(getPharmacyAdminCapabilityView({}), 'full');
    });

    it('resolves views when screens is an array', () => {
      const estArray = {
        views: {
          screens: [
            { screen_id: 'pharmacy_admin', view: 'open_work' },
            { screen_id: 'other', view: 'records' },
          ],
        },
      };
      assert.equal(getPharmacyAdminCapabilityView(estArray), 'open_work');
    });

    it('resolves views when screens is an object dictionary', () => {
      const estObj = {
        views: {
          screens: {
            pharmacy_admin: { view: 'setup' },
          },
        },
      };
      assert.equal(getPharmacyAdminCapabilityView(estObj), 'setup');
    });
  });

  describe('Statutory Rule rule:609bbe13b3 (High-Alert vs OTC Drug Safety)', () => {
    it('requires basic drug attributes: code, name, form, schedule', () => {
      const missingCode = validateDrugInput({ code: '', name: 'Panadol', form: 'Tablet', schedule: 'OTC' });
      assert.equal(missingCode.valid, false);
      assert.match(missingCode.error || '', /code is required/i);

      const missingName = validateDrugInput({ code: 'PAN-01', name: '', form: 'Tablet', schedule: 'OTC' });
      assert.equal(missingName.valid, false);
      assert.match(missingName.error || '', /name is required/i);
    });

    it('strictly forbids high-alert drugs from having OTC schedule (rule:609bbe13b3)', () => {
      const highAlertOtc = validateDrugInput({
        code: 'MOR-10',
        name: 'Morphine Sulphate',
        form: 'Injection',
        schedule: 'OTC',
        high_alert_category: 'Opioid',
      });
      assert.equal(highAlertOtc.valid, false);
      assert.match(highAlertOtc.error || '', /high-alert drug cannot have an otc schedule/i);
    });

    it('strictly forbids high-alert drugs from being marked OTC allowed (rule:609bbe13b3)', () => {
      const highAlertAllowed = validateDrugInput({
        code: 'INS-01',
        name: 'Regular Insulin',
        form: 'Injection',
        schedule: 'ScheduleH',
        is_otc_allowed: true,
        high_alert_category: 'Insulin',
      });
      assert.equal(highAlertAllowed.valid, false);
      assert.match(highAlertAllowed.error || '', /high-alert drug cannot be marked as otc allowed/i);
    });

    it('allows valid standard OTC drug and valid high-alert drug', () => {
      const validOtc = validateDrugInput({
        code: 'PCM-500',
        name: 'Paracetamol 500mg',
        form: 'Tablet',
        schedule: 'OTC',
        is_otc_allowed: true,
        high_alert_category: null,
      });
      assert.equal(validOtc.valid, true);

      const validHighAlert = validateDrugInput({
        code: 'HEP-5000',
        name: 'Heparin Sodium',
        form: 'Injection',
        schedule: 'HospitalOnly',
        high_alert_category: 'Anticoagulant',
        is_restricted: true,
      });
      assert.equal(validHighAlert.valid, true);
    });
  });

  describe('Statutory Rule rule:b828c195cc (Batch Intake & Derived Unit Cost)', () => {
    it('validates mandatory batch fields and positive packaging multipliers', () => {
      const zeroBox = validateBatchInput({
        drug_id: 1,
        batch_no: 'B-01',
        expiry_date: '2028-12-31',
        box_quantity: 0,
        units_per_box: 100,
        total_invoice_cost: 10000,
        retail_price: 15,
      });
      assert.equal(zeroBox.valid, false);
      assert.match(zeroBox.error || '', /box quantity must be greater than zero/i);

      const zeroUnitsPerBox = validateBatchInput({
        drug_id: 1,
        batch_no: 'B-01',
        expiry_date: '2028-12-31',
        box_quantity: 10,
        units_per_box: 0,
        total_invoice_cost: 10000,
        retail_price: 15,
      });
      assert.equal(zeroUnitsPerBox.valid, false);
      assert.match(zeroUnitsPerBox.error || '', /units per box must be greater than zero/i);
    });

    it('derives total units and unit cost accurately from invoice cost (rule:b828c195cc)', () => {
      const validBatch = validateBatchInput({
        drug_id: 1,
        batch_no: 'B-2026-X',
        expiry_date: '2028-06-30',
        box_quantity: 10,
        units_per_box: 50,
        total_invoice_cost: 25000,
        retail_price: 65,
      });
      assert.equal(validBatch.valid, true);
      assert.ok(validBatch.derived);
      // 10 boxes * 50 units/box = 500 units
      assert.equal(validBatch.derived.total_units, 500);
      // 25,000 PKR / 500 units = 50 PKR per unit
      assert.equal(validBatch.derived.unit_cost, 50);
    });
  });

  describe('Statutory Rule rule:f65fc1a5a8 (Supplier Returns Lifecycle & Recall ID)', () => {
    it('strictly requires recall_id when return reason is Recall', () => {
      const missingRecall = validateSupplierReturnInput({
        qty: 100,
        reason: 'Recall',
        recall_id: null,
        note: 'Batch recalled by manufacturer due to dissolution failure',
      });
      assert.equal(missingRecall.valid, false);
      assert.match(missingRecall.error || '', /valid recall id is strictly required when return reason is recall/i);
    });

    it('prohibits recall_id when return reason is not Recall', () => {
      const nonRecallWithId = validateSupplierReturnInput({
        qty: 50,
        reason: 'Expired',
        recall_id: 99,
        note: 'Expired stock return',
      });
      assert.equal(nonRecallWithId.valid, false);
      assert.match(nonRecallWithId.error || '', /recall id can only be specified when return reason is recall/i);
    });

    it('accepts valid returns with reason and mandatory courier/agreement note', () => {
      const validExpired = validateSupplierReturnInput({
        qty: 25,
        reason: 'NearExpiry',
        note: 'TCS Courier consignment #998811 sent to distributor per return policy',
      });
      assert.equal(validExpired.valid, true);

      const validRecall = validateSupplierReturnInput({
        qty: 200,
        reason: 'Recall',
        recall_id: 42,
        note: 'Formal recall batch return handed over to authorized medical rep',
      });
      assert.equal(validRecall.valid, true);
    });
  });

  describe('Stock Adjustments & Vendor Invoices', () => {
    it('validates stock write-off requires quantity and mandatory justification note', () => {
      const missingNote = validateAdjustInput({ qty: 10, reason: 'Damage', note: '   ' });
      assert.equal(missingNote.valid, false);
      assert.match(missingNote.error || '', /mandatory justification note is required/i);

      const validAdjust = validateAdjustInput({ qty: 5, reason: 'Expiry', note: 'Expired ampoules broken in cold chain' });
      assert.equal(validAdjust.valid, true);
    });

    it('validates vendor purchase invoice requires positive total cost', () => {
      const zeroCost = validateVendorInvoiceInput({
        vendor_id: 2,
        invoice_no: 'INV-123',
        total_cost: 0,
      });
      assert.equal(zeroCost.valid, false);

      const validInvoice = validateVendorInvoiceInput({
        vendor_id: 2,
        invoice_no: 'INV-123',
        total_cost: 150000,
      });
      assert.equal(validInvoice.valid, true);
    });
  });

  describe('Statutory Error Dictionary & Value Lists', () => {
    it('covers all standard error codes with English and Urdu translations', () => {
      const codes = ['FORBIDDEN', 'INSUFFICIENT_STOCK', 'NOT_FOUND', 'VALIDATION_ERROR', 'DUPLICATE_RECORD'];
      for (const code of codes) {
        assert.ok(PHARMACY_ADMIN_ERROR_MESSAGES[code], `Missing translation for ${code}`);
        assert.ok(PHARMACY_ADMIN_ERROR_MESSAGES[code].en.length > 0);
        assert.ok(PHARMACY_ADMIN_ERROR_MESSAGES[code].ur.length > 0);
      }
    });

    it('exports all standard drug, schedule, and return enums', () => {
      assert.ok(DRUG_FORMS.includes('Tablet'));
      assert.ok(DRUG_FORMS.includes('Injection'));
      assert.ok(DRUG_SCHEDULES.includes('OTC'));
      assert.ok(DRUG_SCHEDULES.includes('ScheduleH'));
      assert.ok(HIGH_ALERT_CATEGORIES.includes('Chemotherapy'));
      assert.ok(HIGH_ALERT_CATEGORIES.includes('Opioid'));
      assert.ok(ADJUSTMENT_REASONS.includes('Damage'));
      assert.ok(SUPPLIER_RETURN_REASONS.includes('Recall'));
      assert.ok(SUPPLIER_RETURN_REASONS.includes('NearExpiry'));
      assert.ok(VENDOR_INVOICE_TYPES.includes('Purchase'));
      assert.ok(VENDOR_INVOICE_MODULES.includes('Pharmacy'));
    });
  });
});
