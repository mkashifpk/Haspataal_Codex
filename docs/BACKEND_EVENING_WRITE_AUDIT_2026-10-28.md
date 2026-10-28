# Backend evening write/error audit — 28 October 2026

Baseline558a013 → a1f559f knowledge build2026-10-28T15:16:59.584003+00:00. The new-code column compares saved pre-update endpoint error lists, rather than message text. Shared ErrorBox renders codes/details and current state reads; nonserializing data-field aliases associate VALIDATION_ERROR details.fields beside controls and retain input. No automatic business retries were introduced. Actual replay remains an explicit original-key action. All130 existing recovery-contract operations were reread; POST /consents and POST /wristbands were also read. Read-only screens are listed. API/permission/manual limits and execution status are separate from a contract audit: this table does not claim every clinical/IT journey ran. Task mappings can include future or currently unavailable actions; those are labelled below.

| Screen | Endpoint | Newly listed codes | Handled / change |
|---|---|---|---|
| connect_server | — (read only) | — | No business write |
| login | POST /auth/login | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| login | POST /auth/change-password | — | Yes: visible code/details; input kept; no automatic retry. |
| workspace_picker | — (read only) | — | No business write |
| settings | PUT /settings/me | — | Yes: visible code/details; input kept; no automatic retry. |
| settings | POST /settings/me/change-password | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| settings | PUT /admin/settings/{key} | — | Yes: visible code/details; input kept; no automatic retry. |
| settings | POST /admin/change-requests | — | Yes: visible code/details; input kept; no automatic retry. |
| settings | PUT /admin/wards/{ward_id} | NOT_FOUND, VALIDATION_ERROR, WARD_IN_USE | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. Full ward list/editor and occupied/waitlist close guard added; show beds/count; reread /admin/wards. |
| help_center | — (read only) | — | No business write |
| notifications | POST /notifications/{notification_id}/read | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| notifications | POST /notifications/read-all | — | Yes: visible code/details; input kept; no automatic retry. |
| approval_queue | POST /approvals/{request_id}/approve | — | Yes: visible code/details; input kept; no automatic retry. |
| approval_queue | POST /approvals/{request_id}/reject | — | Yes: visible code/details; input kept; no automatic retry. |
| approval_queue | POST /approvals/{request_id}/cancel | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| charity_approvals | POST /approvals/{request_id}/approve | — | Yes: visible code/details; input kept; no automatic retry. |
| charity_approvals | POST /approvals/{request_id}/reject | — | Yes: visible code/details; input kept; no automatic retry. |
| report_incident | POST /incidents | — | Yes: visible code/details; input kept; no automatic retry. |
| facility_profile | POST /establishment/changes/preview | — | Yes: visible code/details; input kept; no automatic retry. |
| facility_profile | POST /establishment/changes | — | Yes: visible code/details; input kept; no automatic retry. |
| app_shell | POST /auth/refresh | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| app_shell | POST /auth/logout | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| my_cash_shift | POST /finance/cash-shifts/open | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| my_cash_shift | POST /finance/cash-shifts/{shift_id}/close | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| queue_management | POST /opd-tickets/{ticket_id}/defer | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| queue_management | POST /opd-tickets/{ticket_id}/cancel | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| queue_management | POST /opd-tickets/{ticket_id}/reactivate | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/refund-request | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/void | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/vip-waiver-post-consult | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/vip-waiver-request | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/credit-request | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| cash_back_prompts | POST /opd-tickets/{ticket_id}/waiver-refund/confirm-dispensation | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| cash_back_prompts | POST /opd-tickets/{ticket_id}/refund/confirm-dispensation | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| patient_search | PATCH /patients/{patient_id} | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| registration | POST /patients/{patient_id}/documents | — | Yes: visible code/details; input kept; no automatic retry. |
| registration | POST /patients | — | Yes: visible code/details; input kept; no automatic retry. |
| registration | POST /opd-tickets/{ticket_id}/pay | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| registration | POST /reception/registrations | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| patient_documents | POST /patients/{patient_id}/documents | — | Yes: visible code/details; input kept; no automatic retry. |
| tariff_display | — (read only) | — | No business write |
| receivables | POST /finance/ar/{ar_id}/settle | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| receivables | POST /finance/ar/{ar_id}/write-off | — | Yes: visible code/details; input kept; no automatic retry. |
| receivables | POST /finance/invoices/{invoice_id}/payments | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| doctor_queue | POST /opd-queues/{queue_id}/call | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| doctor_queue | POST /opd-queues/{queue_id}/reroute | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| icd_picker | — (read only) | — | No business write |
| consultation | POST /clinical-encounters | — | Yes: visible code/details; input kept; no automatic retry. |
| consultation | PATCH /clinical-encounters/{encounter_id} | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consultation | POST /clinical-encounters/{encounter_id}/finalize | — | Yes: visible code/details; input kept; no automatic retry. |
| consultation | POST /clinical-encounters/{encounter_id}/correction | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consultation | POST /opd-tickets/{ticket_id}/complete | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consultation | POST /opd-tickets/{ticket_id}/vip-waiver-post-consult | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consultation | POST /admissions | — | Yes: visible code/details; input kept; no automatic retry. |
| eprescription | POST /prescriptions/{prescription_id}/cancel | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| eprescription | POST /prescriptions | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| eprescription | POST /prescriptions/{prescription_id}/handover | — | Yes: visible code/details; input kept; no automatic retry. |
| lab_orders_results | POST /lab/requisitions/{requisition_id}/cancel | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_orders_results | POST /lab/requisitions | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_orders_results | POST /imaging/orders | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| external_referral | POST /referrals | — | Yes: visible code/details; input kept; no automatic retry. |
| external_referral | POST /referrals/{referral_id}/acknowledge | — | Yes: visible code/details; input kept; no automatic retry. |
| external_referral | POST /referrals/{referral_id}/cancel | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| referral_register | — (read only) | — | No business write |
| patient_education | POST /patients/{patient_id}/education | — | Yes: visible code/details; input kept; no automatic retry. |
| patient_programmes | POST /patients/{patient_id}/programmes | — | Yes: visible code/details; input kept; no automatic retry. |
| patient_programmes | POST /programme-enrolments/{enrolment_id}/entries | — | Yes: visible code/details; input kept; no automatic retry. |
| patient_programmes | POST /programme-enrolments/{enrolment_id}/close | — | Yes: visible code/details; input kept; no automatic retry. |
| home_visit_record | POST /home-visits | — | Yes: visible code/details; input kept; no automatic retry. |
| rx_queue | — (read only) | — | No business write |
| dispense | POST /admissions/{admission_id}/discharge/{stage}/clear | — | Yes: visible code/details; input kept; no automatic retry. |
| dispense | POST /prescriptions/{prescription_id}/dispense | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| dispense | POST /prescriptions/{prescription_id}/items/{item_id}/stop | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| order_queries | POST /prescriptions/{prescription_id}/queries | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| order_queries | POST /prescription-queries/{query_id}/withdraw | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| otc | POST /otc-sales | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| charity_override | POST /pharmacy/charity-override-request | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_only_walkin | POST /patients/lab-only-walk-in | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_only_walkin | POST /finance/invoices/{invoice_id}/payments | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_bench | POST /lab/samples/{sample_id}/collect | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_bench | POST /lab/samples/{sample_id}/receive | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_bench | POST /lab/items/{item_id}/results | — | Yes: visible code/details; input kept; no automatic retry. |
| lab_bench | POST /lab/items/{item_id}/rerun | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_bench | POST /lab/items/{item_id}/corrections | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_bench | POST /lab/samples/{sample_id}/reject | — | Yes: visible code/details; input kept; no automatic retry. |
| lab_verification | POST /lab/results/{result_id}/verify | — | Yes: visible code/details; input kept; no automatic retry. |
| critical_results_bench | POST /critical-results/{critical_result_id}/communications | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| critical_results_verifier | POST /critical-results/{critical_result_id}/communications | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| critical_results_doctor | POST /critical-results/{critical_result_id}/acknowledge | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_send_outs | POST /lab/send-outs | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| lab_send_outs | POST /lab/items/{item_id}/results | — | Yes: visible code/details; input kept; no automatic retry. |
| lab_send_outs | POST /lab/samples/{sample_id}/reject | — | Yes: visible code/details; input kept; no automatic retry. |
| diagnostic_services_list | — (read only) | — | No business write |
| imaging_quality_setup | PUT /imaging/turnaround-targets/{modality} | — | Yes: visible code/details; input kept; no automatic retry. |
| imaging_quality_setup | POST /critical-imaging-findings | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| imaging_quality_setup | PATCH /critical-imaging-findings/{finding_id} | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| radiology_worklist | POST /imaging/orders/{order_id}/status | — | Yes: visible code/details; input kept; no automatic retry. |
| radiology_worklist | POST /imaging/orders/{order_id}/link-study | — | Yes: visible code/details; input kept; no automatic retry. |
| radiology_worklist | POST /imaging/orders/{order_id}/report | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| critical_results_radiology | POST /critical-results/{critical_result_id}/communications | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| imaging_outsourced | POST /imaging/orders/{order_id}/outsource | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| imaging_outsourced | POST /imaging/orders/{order_id}/external-report | — | Yes: visible code/details; input kept; no automatic retry. |
| imaging_repeats | POST /imaging/orders/{order_id}/repeats | — | Yes: visible code/details; input kept; no automatic retry. |
| duty_roster | POST /rosters | — | Yes: visible code/details; input kept; no automatic retry. |
| duty_roster | PATCH /rosters/{roster_id} | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| duty_roster | POST /rosters/{roster_id}/cancel | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| duty_roster | POST /rosters/copy | — | Yes: visible code/details; input kept; no automatic retry. |
| duty_roster | POST /rosters/swaps | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| duty_roster | POST /rosters/swaps/{swap_id}/approve | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| duty_roster | POST /rosters/swaps/{swap_id}/reject | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| roll_call | POST /rosters/roll-call | — | Yes: visible code/details; input kept; no automatic retry. |
| pending_admissions | POST /patients/{patient_id}/documents | — | Yes: visible code/details; input kept; no automatic retry. |
| pending_admissions | POST /admissions/{admission_id}/discharge/{stage}/clear | — | Yes: visible code/details; input kept; no automatic retry. |
| pending_admissions | POST /admissions/{admission_id}/final-bill | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| pending_admissions | POST /admissions/{admission_id}/allocate-bed | — | Yes: visible code/details; input kept; no automatic retry. |
| pending_admissions | POST /admissions/{admission_id}/overflow-override | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| pending_admissions | POST /admissions/{admission_id}/waitlist | REFERENCE_NOT_FOUND, VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| pending_admissions | POST /admissions/{admission_id}/admit | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| pending_admissions | POST /admissions/{admission_id}/cancel | — | Yes: visible code/details; input kept; no automatic retry. |
| pending_admissions | POST /admissions/{admission_id}/confirm-billing | — | Yes: visible code/details; input kept; no automatic retry. |
| bed_matrix | POST /beds/{bed_id}/state | BED_STATE_INVALID, NOT_FOUND, VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. Shared exact-record recovery retained/refreshed (Lab Bench supplies its original barcode explicitly). |
| wristbands_admissions | POST /wristbands | — | Yes: visible code/details; input kept; no automatic retry. |
| consents_admissions | POST /consents | — | Yes: visible code/details; input kept; no automatic retry. |
| consents_admissions | PATCH /consents/{consent_id} | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consents_admissions | POST /consents/{consent_id}/sign | — | Yes: visible code/details; input kept; no automatic retry. |
| consents_admissions | POST /consents/{consent_id}/refuse | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consents_admissions | POST /consents/{consent_id}/withdraw | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consents_admissions | POST /consents/{consent_id}/cancel | VALIDATION_ERROR | Yes: visible code/details; input kept; no automatic retry. Field association added to shared ErrorBox and nonserializing control aliases. |
| consents_admissions | POST /consents/{consent_id}/scan | — | Yes: visible code/details; input kept; no automatic retry. |
| consents_admissions | POST /patients/{patient_id}/documents | — | Yes: visible code/details; input kept; no automatic retry. |

The standalone IT console is currently the Settings system sections, with a new ward panel in Hardware. Department/theatre provisioning and ICD import metadata do not mean those independent journeys are shipped. Other consent workspace aliases are not built; Admissions is the signing flow changed here. Named human acceptance, all-role/service-transition/global IT emergency cases remain pending; never run global logout/maintenance against other developers to manufacture a test pass.
