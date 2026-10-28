# Backend write/error sweep — 28 October 2026

Baseline f5a178b. All 50 delivered screens included. 116 distinct generated write contracts fetched through get_endpoint. Generated inventories can include support endpoints beyond visible controls (not a claim all controls were tested). Generic refusal rendering previously showed server codes/details; shared bridge now performs read-only code-based state recovery. No message-text matching or automatic write replay.

| Screen | Endpoint | Newly listed codes | Handled / change |
|---|---|---|---|
| roll_call | POST /rosters/roll-call | — | Existing behavior retained; no newly listed code. |
| duty_roster | POST /rosters | — | Existing behavior retained; no newly listed code. |
| duty_roster | PATCH /rosters/{roster_id} | ROSTER_DATE_CLOSED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| duty_roster | POST /rosters/{roster_id}/cancel | ROSTER_DATE_CLOSED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| duty_roster | POST /rosters/copy | ROSTER_DATE_CLOSED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| duty_roster | POST /rosters/swaps | SWAP_EXISTS | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| duty_roster | POST /rosters/swaps/{swap_id}/approve | ROSTER_OUT_OF_SCOPE, SWAP_DUTY_STARTED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| duty_roster | POST /rosters/swaps/{swap_id}/reject | ROSTER_OUT_OF_SCOPE, SWAP_SELF_APPROVAL | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| imaging_repeats | POST /imaging/orders/{order_id}/repeats | IMAGING_ORDER_STATE_INVALID | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| imaging_outsourced | POST /imaging/orders/{order_id}/outsource | IMAGING_ORDER_STATE_INVALID | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| imaging_outsourced | POST /imaging/orders/{order_id}/external-report | IMAGING_ORDER_STATE_INVALID | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| critical_results_radiology | POST /critical-results/{critical_result_id}/communications | — | Existing behavior retained; no newly listed code. |
| radiology_worklist | POST /imaging/orders/{order_id}/status | — | Existing behavior retained; no newly listed code. |
| radiology_worklist | POST /imaging/orders/{order_id}/link-study | IMAGING_STUDY_NOT_FOUND, NOT_FOUND, ORTHANC_UNAVAILABLE, PACS_NOT_CONFIGURED, VALIDATION_ERROR | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| radiology_worklist | POST /imaging/orders/{order_id}/report | — | Existing behavior retained; no newly listed code. |
| imaging_quality_setup | PUT /imaging/turnaround-targets/{modality} | — | Existing behavior retained; no newly listed code. |
| imaging_quality_setup | POST /critical-imaging-findings | — | Existing behavior retained; no newly listed code. |
| imaging_quality_setup | PATCH /critical-imaging-findings/{finding_id} | — | Existing behavior retained; no newly listed code. |
| diagnostic_services_list | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| lab_send_outs | POST /lab/send-outs | — | Existing behavior retained; no newly listed code. |
| lab_send_outs | POST /lab/items/{item_id}/results | — | Existing behavior retained; no newly listed code. |
| lab_send_outs | POST /lab/samples/{sample_id}/reject | — | Existing behavior retained; no newly listed code. |
| critical_results_bench | POST /critical-results/{critical_result_id}/communications | — | Existing behavior retained; no newly listed code. |
| critical_results_verifier | POST /critical-results/{critical_result_id}/communications | — | Existing behavior retained; no newly listed code. |
| critical_results_doctor | POST /critical-results/{critical_result_id}/acknowledge | — | Existing behavior retained; no newly listed code. |
| lab_verification | POST /lab/results/{result_id}/verify | — | Existing behavior retained; no newly listed code. |
| lab_bench | POST /lab/samples/{sample_id}/collect | — | Existing behavior retained; no newly listed code. |
| lab_bench | POST /lab/samples/{sample_id}/receive | LAB_PAYMENT_REQUIRED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| lab_bench | POST /lab/items/{item_id}/results | — | Existing behavior retained; no newly listed code. |
| lab_bench | POST /lab/items/{item_id}/rerun | — | Existing behavior retained; no newly listed code. |
| lab_bench | POST /lab/items/{item_id}/corrections | — | Existing behavior retained; no newly listed code. |
| lab_bench | POST /lab/samples/{sample_id}/reject | — | Existing behavior retained; no newly listed code. |
| lab_only_walkin | POST /patients/lab-only-walk-in | — | Existing behavior retained; no newly listed code. |
| lab_only_walkin | POST /finance/invoices/{invoice_id}/payments | — | Existing behavior retained; no newly listed code. |
| charity_override | POST /pharmacy/charity-override-request | DUAL_CONTROL_SAME_PERSON | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| otc | POST /otc-sales | — | Existing behavior retained; no newly listed code. |
| order_queries | POST /prescriptions/{prescription_id}/queries | — | Existing behavior retained; no newly listed code. |
| order_queries | POST /prescription-queries/{query_id}/withdraw | PRESCRIPTION_QUERY_STATE_INVALID | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| dispense | POST /admissions/{admission_id}/discharge/{stage}/clear | — | Existing behavior retained; no newly listed code. |
| dispense | POST /prescriptions/{prescription_id}/dispense | OPD_PHARMACY_CREDIT_NOT_ALLOWED | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| dispense | POST /prescriptions/{prescription_id}/items/{item_id}/stop | — | Existing behavior retained; no newly listed code. |
| rx_queue | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| home_visit_record | POST /home-visits | — | Existing behavior retained; no newly listed code. |
| patient_programmes | POST /patients/{patient_id}/programmes | — | Existing behavior retained; no newly listed code. |
| patient_programmes | POST /programme-enrolments/{enrolment_id}/entries | — | Existing behavior retained; no newly listed code. |
| patient_programmes | POST /programme-enrolments/{enrolment_id}/close | — | Existing behavior retained; no newly listed code. |
| patient_education | POST /patients/{patient_id}/education | — | Existing behavior retained; no newly listed code. |
| referral_register | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| external_referral | POST /referrals | — | Existing behavior retained; no newly listed code. |
| external_referral | POST /referrals/{referral_id}/acknowledge | — | Existing behavior retained; no newly listed code. |
| external_referral | POST /referrals/{referral_id}/cancel | — | Existing behavior retained; no newly listed code. |
| lab_orders_results | POST /lab/requisitions/{requisition_id}/cancel | — | Existing behavior retained; no newly listed code. |
| lab_orders_results | POST /lab/requisitions | AR_OUTSTANDING_BLOCK | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| lab_orders_results | POST /imaging/orders | — | Existing behavior retained; no newly listed code. |
| eprescription | POST /prescriptions/{prescription_id}/cancel | — | Existing behavior retained; no newly listed code. |
| eprescription | POST /prescriptions | — | Existing behavior retained; no newly listed code. |
| eprescription | POST /prescriptions/{prescription_id}/handover | — | Existing behavior retained; no newly listed code. |
| consultation | POST /clinical-encounters | TICKET_PATIENT_MISMATCH | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| consultation | PATCH /clinical-encounters/{encounter_id} | VERSION_CONFLICT | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| consultation | POST /clinical-encounters/{encounter_id}/finalize | — | Existing behavior retained; no newly listed code. |
| consultation | POST /clinical-encounters/{encounter_id}/correction | — | Existing behavior retained; no newly listed code. |
| consultation | POST /opd-tickets/{ticket_id}/complete | — | Existing behavior retained; no newly listed code. |
| consultation | POST /opd-tickets/{ticket_id}/vip-waiver-post-consult | APPROVAL_PENDING, WAIVER_NOT_ALLOWED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| consultation | POST /admissions | — | Existing behavior retained; no newly listed code. |
| icd_picker | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| doctor_queue | POST /opd-queues/{queue_id}/call | QUEUE_ENTRY_CLOSED, TICKET_NOT_PAID | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| doctor_queue | POST /opd-queues/{queue_id}/reroute | TICKET_TRANSITION_INVALID | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| connect_server | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| login | POST /auth/login | — | Existing behavior retained; no newly listed code. |
| login | POST /auth/change-password | — | Existing behavior retained; no newly listed code. |
| app_shell | POST /auth/refresh | ACCOUNT_DISABLED, TOKEN_EXPIRED, UNAUTHENTICATED | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| app_shell | POST /auth/logout | — | Existing behavior retained; no newly listed code. |
| settings | PUT /settings/me | — | Existing behavior retained; no newly listed code. |
| settings | POST /settings/me/change-password | — | Existing behavior retained; no newly listed code. |
| settings | PUT /admin/settings/{key} | — | Existing behavior retained; no newly listed code. |
| settings | POST /admin/change-requests | — | Existing behavior retained; no newly listed code. |
| notifications | POST /notifications/{notification_id}/read | — | Existing behavior retained; no newly listed code. |
| notifications | POST /notifications/read-all | — | Existing behavior retained; no newly listed code. |
| help_center | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| approval_queue | POST /approvals/{request_id}/approve | — | Existing behavior retained; no newly listed code. |
| approval_queue | POST /approvals/{request_id}/reject | SELF_APPROVAL_FORBIDDEN | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| approval_queue | POST /approvals/{request_id}/cancel | — | Existing behavior retained; no newly listed code. |
| charity_approvals | POST /approvals/{request_id}/approve | — | Existing behavior retained; no newly listed code. |
| charity_approvals | POST /approvals/{request_id}/reject | SELF_APPROVAL_FORBIDDEN | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| report_incident | POST /incidents | — | Existing behavior retained; no newly listed code. |
| facility_profile | POST /establishment/changes/preview | — | Existing behavior retained; no newly listed code. |
| facility_profile | POST /establishment/changes | — | Existing behavior retained; no newly listed code. |
| workspace_picker | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| my_cash_shift | POST /finance/cash-shifts/open | — | Existing behavior retained; no newly listed code. |
| my_cash_shift | POST /finance/cash-shifts/{shift_id}/close | — | Existing behavior retained; no newly listed code. |
| queue_management | POST /opd-tickets/{ticket_id}/defer | — | Existing behavior retained; no newly listed code. |
| queue_management | POST /opd-tickets/{ticket_id}/reactivate | TICKET_EXPIRED, TICKET_TRANSITION_INVALID | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| queue_management | POST /opd-tickets/{ticket_id}/cancel | — | Existing behavior retained; no newly listed code. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/void | — | Existing behavior retained; no newly listed code. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/refund-request | APPROVAL_PENDING, REFUND_EXCEEDS_PAID, TICKET_NOT_ACTIVE | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/vip-waiver-request | APPROVAL_PENDING, WAIVER_NOT_ALLOWED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/vip-waiver-post-consult | APPROVAL_PENDING, WAIVER_NOT_ALLOWED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| refund_waiver_credit | POST /opd-tickets/{ticket_id}/credit-request | APPROVAL_PENDING, CREDIT_NOT_ALLOWED | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| cash_back_prompts | POST /opd-tickets/{ticket_id}/refund/confirm-dispensation | — | Existing behavior retained; no newly listed code. |
| cash_back_prompts | POST /opd-tickets/{ticket_id}/waiver-refund/confirm-dispensation | — | Existing behavior retained; no newly listed code. |
| patient_search | PATCH /patients/{patient_id} | — | Existing behavior retained; no newly listed code. |
| registration | POST /patients/{patient_id}/documents | — | Existing behavior retained; no newly listed code. |
| registration | POST /patients | — | Existing behavior retained; no newly listed code. |
| registration | POST /opd-tickets/{ticket_id}/pay | TICKET_NOT_ACTIVE | Changed: code-based record reread via contract/original reconcile path; current state displayed; input retained; no automatic write retry. |
| registration | POST /reception/registrations | LAB_ONLY_QUEUE_FORBIDDEN | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| patient_documents | POST /patients/{patient_id}/documents | — | Existing behavior retained; no newly listed code. |
| tariff_display | No writes declared in generated screen contract | — | N/A — read-only or native shell behavior |
| receivables | POST /finance/ar/{ar_id}/settle | OVERPAYMENT | Yes: code-catalogue dispatch and refusal guidance, server details visible, input retained; no automatic write retry. |
| receivables | POST /finance/ar/{ar_id}/write-off | — | Existing behavior retained; no newly listed code. |
| receivables | POST /finance/invoices/{invoice_id}/payments | — | Existing behavior retained; no newly listed code. |
| it_console (Settings support) | POST /admin/users/{user_id}/revoke-sessions | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/departments/{department_id} | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/wards/{ward_id} | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/printers/{printer_id} | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/terminals/{terminal_id} | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/users | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/users/{user_id}/roles | DEMO_ACCOUNT_PROTECTED | Code-dispatched refusal guidance; no automatic retry or draft loss. Demo account protection not re-exercised with account mutations. |
| it_console (Settings support) | POST /admin/users/{user_id}/reset-password | DEMO_ACCOUNT_PROTECTED, NOT_FOUND | Code-dispatched refusal guidance; no automatic retry or draft loss. Demo account protection not re-exercised with account mutations. |
| it_console (Settings support) | POST /admin/users/{user_id}/active | DEMO_ACCOUNT_PROTECTED, NOT_FOUND, VALIDATION_ERROR | Code-dispatched refusal guidance; no automatic retry or draft loss. Demo account protection not re-exercised with account mutations. |
| it_console (Settings support) | PUT /admin/roles/{role_code}/permissions | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/terminals | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/printers | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/badge-stations/{station_id} | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/badge-stations/{station_id}/rotate-key | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/settings/{key} | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | PUT /admin/maintenance | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/kill-switch | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/departments | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/wards | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/wards/{ward_id}/beds | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /ot/theaters | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /icd/releases | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /icd/releases/{release_id}/activate | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/first-owner | — | No newly listed code; native/settings support contract retained. |
| it_console (Settings support) | POST /admin/change-requests | — | No newly listed code; native/settings support contract retained. |