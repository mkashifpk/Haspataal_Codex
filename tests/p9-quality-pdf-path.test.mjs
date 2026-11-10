import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {isQualityRegisterPdfPath: allowed}=createRequire(import.meta.url)('../electron/p9-quality-pdf-path.cjs');
test('Quality PDFs admit only documented paths and canonical date queries',()=>{
  assert(allowed('/consent-policy/pdf'));
  assert(!allowed('/consent-policy/pdf?scope=all'));
  assert(allowed('/incidents/8/adr-report/pdf'));
  assert(allowed('/blood/reactions/17/pdf'));
  assert(allowed('/quality/record-reviews/2/report/pdf'));
  for (const p of ['/quality/record-reviews/0/report/pdf', '/quality/record-reviews/02/report/pdf', '/quality/record-reviews/2/report/pdf?x=1', '/quality/record-reviews/2/report/pdf/extra']) assert(!allowed(p));
  assert(allowed('/maternity/labour-register/pdf?date_from=2026-11-01&date_to=2026-11-09'));
  for(const p of ['/incidents/0/adr-report/pdf','/blood/reactions/01/pdf','/blood/reactions/1/pdf?x=1','/maternity/labour-register/pdf','/blood/statistics/pdf?date_from=2026-11-01&date_to=2026-11-09&x=1','https://example.org/blood/reactions/1/pdf','/blood/reactions/1/pdf\n','/maternity/assessments/register/pdf?date_to=2026-11-09&date_from=2026-11-01']) assert(!allowed(p));
});
