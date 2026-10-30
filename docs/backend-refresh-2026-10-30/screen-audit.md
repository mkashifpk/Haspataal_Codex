| Screen | Added calls | Removed calls | Added / removed events |
|---|---|---|---|
| approval_queue | — | — | — |
| app_shell | — | — | — |
| bed_matrix | — | — | — |
| cash_back_prompts | — | — | — |
| charity_approvals | — | — | — |
| charity_override | — | — | — |
| connect_server | — | — | — |
| consents_admissions | — | — | — |
| consultation | POST /opd-queues/{queue_id}/reroute<br>GET /opd-queues/doctors | — | — |
| cost_estimates_admissions | GET /cost-estimates/admissions/{admission_id}/moves | GET /admissions/{admission_id}/transfers | — |
| cost_estimates_billing | GET /cost-estimates/admissions/{admission_id}/moves | GET /admissions/{admission_id}/transfers | — |
| critical_results_bench | — | — | — |
| critical_results_doctor | — | — | — |
| critical_results_radiology | — | — | — |
| critical_results_verifier | — | — | — |
| diagnostic_services_list | — | — | — |
| dispense | — | POST /prescriptions/{prescription_id}/items/{item_id}/stop | — |
| doctor_inpatients | GET /ipd/treating-doctors<br>GET /admissions/{admission_id}/treating-doctor<br>POST /admissions/{admission_id}/treating-doctor<br>GET /staff/lookup | — | +admission.doctor_changed |
| doctor_queue | GET /opd-queues/doctors | — | — |
| duty_roster | — | GET /hr/shift-patterns | — |
| eprescription | — | — | — |
| explain_estimate | — | — | — |
| external_referral | — | — | — |
| facility_profile | — | — | — |
| help_center | — | — | — |
| home_visit_record | — | — | — |
| icd_picker | — | — | — |
| imaging_outsourced | — | — | — |
| imaging_quality_setup | — | — | — |
| imaging_repeats | — | — | — |
| it_console | — | — | — |
| lab_bench | — | — | — |
| lab_only_walkin | — | — | — |
| lab_orders_results | — | — | — |
| lab_send_outs | — | — | — |
| lab_verification | — | — | — |
| login | — | — | — |
| mar | GET /admissions/{admission_id}/mar/prn-orders<br>GET /mar/{mar_id}/dose-label | — | — |
| my_beds | — | — | — |
| my_cash_shift | — | — | — |
| notifications | — | — | — |
| nursing_assessment | — | — | — |
| order_queries | — | — | — |
| otc | — | — | — |
| patient_documents | — | — | — |
| patient_education | — | — | — |
| patient_education_ward | — | — | — |
| patient_programmes | — | — | — |
| patient_search | — | — | — |
| pending_admissions | — | — | — |
| queue_management | — | — | — |
| radiology_worklist | — | — | — |
| receivables | — | — | — |
| referral_register | — | — | — |
| refund_waiver_credit | — | POST /opd-tickets/{ticket_id}/vip-waiver-post-consult | — |
| registration | GET /opd-queues/doctors | — | — |
| report_incident | — | — | — |
| roll_call | — | — | — |
| rx_queue | — | — | — |
| settings | — | — | — |
| tariff_display | — | — | — |
| verbal_orders_ward | — | — | — |
| vitals_tracker | — | — | — |
| workspace_picker | — | — | — |
| wristbands_admissions | — | — | — |
