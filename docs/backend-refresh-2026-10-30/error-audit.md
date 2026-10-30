| Screen | Endpoint | Newly listed codes | Handled |
|---|---|---|---|
| approval_queue | GET /approvals | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| approval_queue | GET /approvals/{request_id} | FORBIDDEN, NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| approval_queue | POST /approvals/{request_id}/reject | SELF_APPROVAL_FORBIDDEN | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| approval_queue | POST /approvals/{request_id}/cancel | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| app_shell | POST /auth/refresh | ACCOUNT_DISABLED, TOKEN_EXPIRED, UNAUTHENTICATED, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| app_shell | POST /auth/logout | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| bed_matrix | GET /beds/matrix | BED_NO_LONGER_AVAILABLE, FORBIDDEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| cash_back_prompts | GET /opd-tickets/{ticket_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| cash_back_prompts | POST /opd-tickets/{ticket_id}/refund/confirm-dispensation | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| cash_back_prompts | POST /opd-tickets/{ticket_id}/waiver-refund/confirm-dispensation | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| charity_approvals | GET /approvals | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| charity_approvals | GET /approvals/{request_id} | FORBIDDEN, NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| charity_approvals | POST /approvals/{request_id}/reject | SELF_APPROVAL_FORBIDDEN | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| charity_override | POST /pharmacy/charity-override-request | DUAL_CONTROL_SAME_PERSON, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| charity_override | GET /approvals | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consents_admissions | PATCH /consents/{consent_id} | CONSENT_TEXT_MISSING | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | GET /patients/{patient_id}/documents | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | GET /patient-documents/{document_id}/download | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | PATCH /clinical-encounters/{encounter_id} | ICD_CODE_UNKNOWN | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | POST /opd-tickets/{ticket_id}/vip-waiver-post-consult | APPROVAL_PENDING, VALIDATION_ERROR, WAIVER_NOT_ALLOWED | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | GET /beds/matrix | BED_NO_LONGER_AVAILABLE, FORBIDDEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | GET /icd/browse | ICD_SYSTEM_NOT_LOADED, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | GET /icd/codes/{code} | ICD_SYSTEM_NOT_LOADED, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | POST /opd-queues/{queue_id}/reroute | FORBIDDEN, REFERENCE_NOT_FOUND, TICKET_TRANSITION_INVALID, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| consultation | GET /opd-queues/doctors | FORBIDDEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| cost_estimates_admissions | GET /cost-estimates/admissions/{admission_id}/moves | FORBIDDEN, NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| cost_estimates_billing | GET /cost-estimates/admissions/{admission_id}/moves | FORBIDDEN, NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_bench | GET /critical-results | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_bench | GET /critical-results/{critical_result_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_bench | POST /critical-results/{critical_result_id}/communications | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_bench | GET /diagnostics/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_doctor | GET /critical-results | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_doctor | GET /critical-results/{critical_result_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_doctor | POST /critical-results/{critical_result_id}/acknowledge | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_doctor | GET /diagnostics/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_radiology | GET /critical-results | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_radiology | GET /critical-results/{critical_result_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_radiology | POST /critical-results/{critical_result_id}/communications | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_radiology | GET /diagnostics/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_verifier | GET /critical-results | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_verifier | GET /critical-results/{critical_result_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_verifier | POST /critical-results/{critical_result_id}/communications | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| critical_results_verifier | GET /diagnostics/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| dispense | GET /admissions/{admission_id}/discharge-status | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| dispense | POST /prescriptions/{prescription_id}/dispense | OVERPAYMENT, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| dispense | GET /dispensations/{dispensation_id}/receipt-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| dispense | GET /dispensations/{dispensation_id}/labels | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | GET /admissions | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | GET /admissions/{admission_id}/mar | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | GET /admissions/{admission_id}/discharge-status | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | GET /patients/{patient_id}/documents | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | GET /patient-documents/{document_id}/download | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | GET /ipd/treating-doctors | FORBIDDEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | GET /admissions/{admission_id}/treating-doctor | NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_inpatients | POST /admissions/{admission_id}/treating-doctor | ADMISSION_STATE_INVALID, FORBIDDEN, NOT_FOUND, REFERENCE_NOT_FOUND, TREATING_DOCTOR_ONLY, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_queue | POST /opd-queues/{queue_id}/call | QUEUE_ENTRY_CLOSED, TICKET_NOT_PAID, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_queue | POST /opd-queues/{queue_id}/reroute | FORBIDDEN, REFERENCE_NOT_FOUND, TICKET_TRANSITION_INVALID, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| doctor_queue | GET /opd-queues/doctors | FORBIDDEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | GET /rosters | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | GET /rosters/staff | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | PATCH /rosters/{roster_id} | ROSTER_CONFLICT, ROSTER_EMPLOYEE_INACTIVE, ROSTER_ON_LEAVE, ROSTER_OUT_OF_SCOPE, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | POST /rosters/{roster_id}/cancel | ROSTER_OUT_OF_SCOPE, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | POST /rosters/copy | ROSTER_CONFLICT, ROSTER_EMPLOYEE_INACTIVE, ROSTER_ON_LEAVE, ROSTER_OUT_OF_SCOPE | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | GET /rosters/week | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | GET /rosters/swaps | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | POST /rosters/swaps | ROSTER_EMPLOYEE_INACTIVE, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | POST /rosters/swaps/{swap_id}/approve | ROSTER_CONFLICT, ROSTER_ON_LEAVE, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | POST /rosters/swaps/{swap_id}/reject | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| duty_roster | GET /beds/matrix | BED_NO_LONGER_AVAILABLE, FORBIDDEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| eprescription | POST /prescriptions/{prescription_id}/cancel | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| eprescription | GET /drugs/{drug_id}/stock-status | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| eprescription | POST /prescriptions | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| eprescription | GET /prescriptions/{prescription_id}/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| external_referral | GET /referrals/{referral_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| external_referral | POST /referrals/{referral_id}/cancel | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| external_referral | GET /referrals/{referral_id}/pdf | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| external_referral | GET /mlc/contacts | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| facility_profile | GET /establishment/changes | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| facility_profile | GET /establishment/changes/{change_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| facility_profile | GET /facility/compliance-documents | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| icd_picker | GET /icd/browse | ICD_SYSTEM_NOT_LOADED, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| icd_picker | GET /icd/codes/{code} | ICD_SYSTEM_NOT_LOADED, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| imaging_outsourced | GET /diagnostic-partners | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| imaging_outsourced | POST /imaging/orders/{order_id}/outsource | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| imaging_outsourced | GET /imaging/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| imaging_quality_setup | GET /critical-imaging-findings | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| imaging_quality_setup | POST /critical-imaging-findings | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| imaging_quality_setup | PATCH /critical-imaging-findings/{finding_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| imaging_repeats | GET /imaging/repeats | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| it_console | POST /admin/change-requests | DEMO_ACCOUNT_PROTECTED, ICD_SYSTEM_NOT_LOADED | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| it_console | GET /admin/change-requests | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| it_console | GET /admin/change-requests/{change_request_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | GET /lab/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | POST /lab/samples/{sample_id}/collect | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | GET /lab/samples/{sample_id}/label | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | GET /lab/scan/{barcode} | LAB_SAMPLE_NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | POST /lab/samples/{sample_id}/receive | LAB_PAYMENT_REQUIRED, PATIENT_IDENTITY_MISMATCH, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | POST /lab/items/{item_id}/results | INSUFFICIENT_STOCK | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | POST /lab/items/{item_id}/rerun | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | POST /lab/items/{item_id}/corrections | INSUFFICIENT_STOCK, LAB_METRICS_INVALID, LAB_REAGENT_BOM_MISSING, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_bench | GET /wristbands/verify | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_only_walkin | POST /patients/lab-only-walk-in | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_only_walkin | GET /lab/tests | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_only_walkin | POST /finance/invoices/{invoice_id}/payments | INVOICE_LOCKED, OVERPAYMENT, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_only_walkin | GET /lab/requisitions | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_only_walkin | GET /lab/requisitions/{requisition_id}/report/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_only_walkin | GET /lab/requisitions/{requisition_id}/report/pdf | LAB_REPORT_NOT_READY, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /lab/requisitions | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | POST /lab/requisitions/{requisition_id}/cancel | INVOICE_HAS_PAYMENTS, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /lab/tests | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | POST /lab/requisitions | AR_OUTSTANDING_BLOCK, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /lab/requisitions/{requisition_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /lab/patients/{patient_id}/results | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | POST /imaging/orders | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /imaging/orders | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /imaging/orders/{order_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /lab/requisitions/{requisition_id}/report/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /lab/requisitions/{requisition_id}/report/pdf | LAB_REPORT_NOT_READY, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /imaging/orders/{order_id}/report/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_orders_results | GET /imaging/orders/{order_id}/report/pdf | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_send_outs | POST /lab/send-outs | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_send_outs | GET /lab/send-outs | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_send_outs | GET /lab/send-outs/{send_out_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_send_outs | GET /lab/send-outs/{send_out_id}/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_send_outs | GET /diagnostic-partners | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_send_outs | POST /lab/items/{item_id}/results | INSUFFICIENT_STOCK | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_verification | GET /lab/requisitions/{requisition_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_verification | GET /lab/requisitions/{requisition_id}/report/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| lab_verification | GET /lab/requisitions/{requisition_id}/report/pdf | LAB_REPORT_NOT_READY, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| login | POST /auth/login | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | GET /admissions/{admission_id}/mar | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | POST /admissions/{admission_id}/mar/prn | ADMINISTRATION_NOT_AUTHORIZED, ADMINISTRATION_VARIANCE_REASON_REQUIRED, DRUG_MISMATCH, HIGH_ALERT_CHECK_REQUIRED, MEDICATION_ORDER_INVALID, MEDICATION_ORDER_STOPPED, PATIENT_IDENTITY_MISMATCH, PATIENT_IDENTITY_REQUIRED, REFERENCE_NOT_FOUND, SELF_ADMINISTRATION_INVALID, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | POST /mar/{mar_id}/correction | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | POST /admissions/{admission_id}/mar/generate | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | GET /wards/{ward_id}/inventory | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | POST /mar/{mar_id}/prepare | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | GET /admissions/{admission_id}/mar/prn-orders | NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| mar | GET /mar/{mar_id}/dose-label | DOSE_NOT_PREPARED, NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| my_beds | POST /beds/{bed_id}/mark-cleaned | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| my_cash_shift | POST /finance/cash-shifts/open | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| my_cash_shift | GET /finance/cash-shifts/{shift_id}/transactions | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| my_cash_shift | POST /finance/cash-shifts/{shift_id}/close | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| notifications | GET /notifications | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| notifications | POST /notifications/{notification_id}/read | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| order_queries | POST /prescriptions/{prescription_id}/queries | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| order_queries | GET /prescription-queries | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| order_queries | POST /prescription-queries/{query_id}/withdraw | PRESCRIPTION_QUERY_STATE_INVALID, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| order_queries | GET /prescriptions/{prescription_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| otc | POST /otc-sales | INSUFFICIENT_STOCK, OVERPAYMENT, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_documents | GET /patients/{patient_id}/documents | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_documents | GET /patient-documents/{document_id}/download | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_programmes | GET /patients/{patient_id}/programmes | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_programmes | GET /preventive-programmes | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_programmes | GET /preventive-programmes/due | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_search | PATCH /patients/{patient_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_search | GET /patients/{patient_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| patient_search | GET /patients/{patient_id}/financial-summary | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | GET /patients/{patient_id}/documents | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | GET /patient-documents/{document_id}/download | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | POST /admissions/{admission_id}/final-bill | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | GET /admissions | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | POST /admissions/{admission_id}/overflow-override | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | POST /admissions/{admission_id}/waitlist | REFERENCE_NOT_FOUND, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | GET /wards/{ward_id}/waitlist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| pending_admissions | POST /admissions/{admission_id}/admit | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| queue_management | GET /opd-tickets/{ticket_id}/status-history | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| queue_management | GET /opd-queues/by-doctor/{doctor_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| queue_management | POST /opd-tickets/{ticket_id}/defer | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| queue_management | POST /opd-tickets/{ticket_id}/reactivate | TICKET_EXPIRED, TICKET_TRANSITION_INVALID, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| queue_management | POST /opd-tickets/{ticket_id}/cancel | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| queue_management | GET /opd-tickets/by-number/{ticket_number} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | GET /imaging/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | POST /imaging/orders/{order_id}/status | INVOICE_HAS_PAYMENTS | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | POST /imaging/orders/{order_id}/report | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | GET /imaging/orders/{order_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | GET /critical-imaging-findings | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | GET /wristbands/verify | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | GET /imaging/orders/{order_id}/report/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| radiology_worklist | GET /imaging/orders/{order_id}/report/pdf | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| receivables | POST /finance/ar/{ar_id}/settle | OVERPAYMENT, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| receivables | POST /finance/invoices/{invoice_id}/payments | INVOICE_LOCKED, OVERPAYMENT, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| receivables | GET /finance/invoices | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| receivables | GET /finance/invoices/{invoice_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| referral_register | GET /referrals/{referral_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| referral_register | GET /referrals/{referral_id}/pdf | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/void | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/refund-request | APPROVAL_PENDING, REFUND_EXCEEDS_PAID, TICKET_NOT_ACTIVE, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/vip-waiver-request | APPROVAL_PENDING, VALIDATION_ERROR, WAIVER_NOT_ALLOWED | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/credit-request | APPROVAL_PENDING, CREDIT_NOT_ALLOWED, INVOICE_LOCKED, OVERPAYMENT, SHIFT_NOT_OPEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| refund_waiver_credit | GET /opd-tickets/{ticket_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| refund_waiver_credit | GET /approvals | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| registration | GET /patients/{patient_id}/documents | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| registration | GET /patient-documents/{document_id}/download | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| registration | POST /opd-tickets/{ticket_id}/pay | INVOICE_LOCKED, OVERPAYMENT, TICKET_NOT_ACTIVE, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| registration | POST /reception/registrations | LAB_ONLY_QUEUE_FORBIDDEN, OVERPAYMENT, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| registration | GET /finance/service-catalog | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| registration | GET /opd-tickets/{ticket_id}/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| registration | GET /opd-queues/doctors | FORBIDDEN, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| report_incident | GET /incident-types | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| report_incident | GET /incidents | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| report_incident | GET /incidents/{incident_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| roll_call | GET /rosters/roll-call | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| roll_call | POST /rosters/roll-call | ROSTER_EMPLOYEE_INACTIVE | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| rx_queue | GET /prescriptions/{prescription_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| settings | POST /settings/me/change-password | DEMO_ACCOUNT_PROTECTED, PASSWORD_POLICY, VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| settings | POST /admin/change-requests | DEMO_ACCOUNT_PROTECTED, ICD_SYSTEM_NOT_LOADED | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| settings | GET /admin/change-requests | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| settings | GET /admin/change-requests/{change_request_id} | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| verbal_orders_ward | POST /prescriptions/verbal | PRESCRIPTION_INCOMPLETE | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| wristbands_admissions | GET /wristbands | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| wristbands_admissions | GET /wristbands/{wristband_id}/print-payload | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| wristbands_admissions | GET /wristbands/verify | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
| wristbands_admissions | GET /medication-safety/worklist | VALIDATION_ERROR | Code guidance + field binding; declared GET reconciliation only, no write retry. DEV verification pending. |
