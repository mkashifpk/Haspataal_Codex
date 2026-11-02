import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getMedicationSafetySetupCapabilityView,
  validateDrugSafetyPatch,
  validateLasaPairInput,
  validateLasaPairUpdate,
  MEDICATION_SAFETY_ERROR_MESSAGES,
  HIGH_ALERT_CATEGORIES,
  HIGH_ALERT_CATEGORY_LABELS,
} from '../src/medication-safety-setup-policy.ts';

describe('medication_safety_setup: Domain Policy & Business Rules (Screen 136)', () => {
  describe('Capability View Resolution', () => {
    it('defaults to full when establishment is undefined or missing views', () => {
      assert.equal(getMedicationSafetySetupCapabilityView(undefined), 'full');
      assert.equal(getMedicationSafetySetupCapabilityView(null), 'full');
      assert.equal(getMedicationSafetySetupCapabilityView({}), 'full');
    });

    it('resolves views when screens is an array', () => {
      const estArray = {
        views: {
          screens: [
            { screen_id: 'medication_safety_setup', view: 'setup' },
            { screen_id: 'other', view: 'records' },
          ],
        },
      };
      assert.equal(getMedicationSafetySetupCapabilityView(estArray), 'setup');
    });

    it('resolves views when screens is an object dictionary', () => {
      const estObj = {
        views: {
          screens: {
            medication_safety_setup: { view: 'open_work' },
          },
        },
      };
      assert.equal(getMedicationSafetySetupCapabilityView(estObj), 'open_work');
    });
  });

  describe('Statutory Rule rule:a8dc0017ab (Safety Flags & OTC Prohibition)', () => {
    it('strictly forbids assigning high-alert category to an OTC medicine', () => {
      const otcDrug = validateDrugSafetyPatch(
        { high_alert_category: 'ConcentratedElectrolyte' },
        'OTC',
        false
      );
      assert.equal(otcDrug.valid, false);
      assert.match(otcDrug.error || '', /can never be assigned to an otc medicine/i);

      const otcAllowedDrug = validateDrugSafetyPatch(
        { high_alert_category: 'Opioid' },
        'ScheduleH',
        true
      );
      assert.equal(otcAllowedDrug.valid, false);
      assert.match(otcAllowedDrug.error || '', /can never be assigned to an otc medicine/i);
    });

    it('allows null to clear high-alert category per rule:a8dc0017ab', () => {
      const clearHighAlert = validateDrugSafetyPatch(
        { high_alert_category: null },
        'ScheduleH',
        false
      );
      assert.equal(clearHighAlert.valid, true);
    });

    it('allows valid high-alert category on non-OTC medicine and restricted prescribing flag', () => {
      const validHighAlert = validateDrugSafetyPatch(
        { high_alert_category: 'Chemotherapy', is_restricted: true },
        'HospitalOnly',
        false
      );
      assert.equal(validHighAlert.valid, true);

      const validRestrictedOnly = validateDrugSafetyPatch(
        { high_alert_category: null, is_restricted: true },
        'ScheduleH',
        false
      );
      assert.equal(validRestrictedOnly.valid, true);
    });
  });

  describe('Statutory Rule rule:a8dc0017ab (Look-Alike / Sound-Alike LASA Pairs)', () => {
    it('requires primary and partner medicine IDs and forbids pairing a drug with itself', () => {
      const sameDrug = validateLasaPairInput({
        drug_id: 15,
        other_drug_id: 15,
        note: 'Looks alike',
      });
      assert.equal(sameDrug.valid, false);
      assert.match(sameDrug.error || '', /cannot be paired with itself/i);
    });

    it('strictly requires a differentiation note on how to tell medicines apart', () => {
      const missingNote = validateLasaPairInput({
        drug_id: 10,
        other_drug_id: 20,
        note: '   ',
      });
      assert.equal(missingNote.valid, false);
      assert.match(missingNote.error || '', /distinction note explaining how to tell the medicines apart is required/i);
    });

    it('detects and rejects duplicate active LASA pairs in either direction (LASA_PAIR_EXISTS)', () => {
      const existing = [
        { drug_id: 101, other_drug_id: 202, is_active: true },
        { drug_id: 303, other_drug_id: 404, is_active: false }, // retired
      ];

      // Exact direction duplicate
      const dup1 = validateLasaPairInput({ drug_id: 101, other_drug_id: 202, note: 'Tall Man lettering' }, existing);
      assert.equal(dup1.valid, false);
      assert.match(dup1.error || '', /already paired/i);

      // Reverse direction duplicate
      const dup2 = validateLasaPairInput({ drug_id: 202, other_drug_id: 101, note: 'Tall Man lettering' }, existing);
      assert.equal(dup2.valid, false);
      assert.match(dup2.error || '', /already paired/i);

      // Re-pairing a retired pair is permitted
      const rePairRetired = validateLasaPairInput({ drug_id: 303, other_drug_id: 404, note: 'Reactivated pairing' }, existing);
      assert.equal(rePairRetired.valid, true);
    });

    it('validates LASA pair updates and allows retiring a pair with is_active false', () => {
      const emptyNoteUpdate = validateLasaPairUpdate({ note: '   ' });
      assert.equal(emptyNoteUpdate.valid, false);
      assert.match(emptyNoteUpdate.error || '', /distinction note cannot be empty/i);

      const retirePair = validateLasaPairUpdate({ is_active: false });
      assert.equal(retirePair.valid, true);

      const validUpdate = validateLasaPairUpdate({ note: 'Updated DOPamine vs DoBUTamine packaging notice', is_active: true });
      assert.equal(validUpdate.valid, true);
    });
  });

  describe('Statutory Error Messages & High-Alert Categories', () => {
    it('covers all standard error codes with English and Urdu translations', () => {
      const codes = ['FORBIDDEN', 'VALIDATION_ERROR', 'LASA_PAIR_EXISTS', 'NOT_FOUND', 'VERSION_CONFLICT'];
      for (const code of codes) {
        assert.ok(MEDICATION_SAFETY_ERROR_MESSAGES[code], `Missing translation for ${code}`);
        assert.ok(MEDICATION_SAFETY_ERROR_MESSAGES[code].en.length > 0);
        assert.ok(MEDICATION_SAFETY_ERROR_MESSAGES[code].ur.length > 0);
      }
    });

    it('exports all 12 standard high-alert medication categories with labels', () => {
      assert.equal(HIGH_ALERT_CATEGORIES.length, 12);
      for (const cat of HIGH_ALERT_CATEGORIES) {
        assert.ok(HIGH_ALERT_CATEGORY_LABELS[cat], `Missing label for ${cat}`);
        assert.ok(HIGH_ALERT_CATEGORY_LABELS[cat].en.length > 0);
        assert.ok(HIGH_ALERT_CATEGORY_LABELS[cat].ur.length > 0);
      }
    });
  });
});
