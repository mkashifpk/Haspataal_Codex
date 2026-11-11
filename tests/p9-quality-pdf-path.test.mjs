import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {isQualityRegisterPdfPath: allowed}=createRequire(import.meta.url)('../electron/p9-quality-pdf-path.cjs');
test('Quality PDFs admit only documented paths and canonical date queries',()=>{
  assert(allowed('/consent-policy/pdf'));
  for (const p of ['/personnel/appraisal-policy/pdf', '/personnel/appraisals/7/pdf', '/personnel/employees/7/file/pdf']) {
    assert(allowed(p));
    assert(!allowed(p + '?scope=all'));
    assert(!allowed(p + '/extra'));
  }
  assert(!allowed('/personnel/employees/07/file/pdf'));
  assert(!allowed('/personnel/employees/7/health/pdf'));
  assert(!allowed('/consent-policy/pdf?scope=all'));
  assert(allowed('/incidents/8/adr-report/pdf'));
  assert(allowed('/blood/reactions/17/pdf'));
  for (const p of ['/tariff/pricing-policy/pdf', '/tariff/pdf', '/medication-safety/policy/pdf']) {
    assert(allowed(p));
    assert(!allowed(p + '?scope=all'));
    assert(!allowed(p + '/extra'));
  }
  assert(allowed('/quality/record-reviews/2/report/pdf'));
  assert(allowed('/committee-meetings/1/pdf'));
  assert(!allowed('/committee-meetings/01/pdf'));
  assert(!allowed('/committee-meetings/1/pdf?scope=all'));
  for (const p of ['/infection/report/pdf', '/quality/indicators/pdf']) {
    assert(allowed(p + '?date_from=2026-10-01&date_to=2026-10-31'));
    assert(!allowed(p + '?date_from=2026-10-01&date_to=2026-10-31&scope=all'));
  }
  for (const p of ['/quality/record-reviews/0/report/pdf', '/quality/record-reviews/02/report/pdf', '/quality/record-reviews/2/report/pdf?x=1', '/quality/record-reviews/2/report/pdf/extra']) assert(!allowed(p));
  assert(allowed('/maternity/labour-register/pdf?date_from=2026-11-01&date_to=2026-11-09'));
  for(const p of ['/incidents/0/adr-report/pdf','/blood/reactions/01/pdf','/blood/reactions/1/pdf?x=1','/maternity/labour-register/pdf','/blood/statistics/pdf?date_from=2026-11-01&date_to=2026-11-09&x=1','https://example.org/blood/reactions/1/pdf','/blood/reactions/1/pdf\n','/maternity/assessments/register/pdf?date_to=2026-11-09&date_from=2026-11-01']) assert(!allowed(p));
});
