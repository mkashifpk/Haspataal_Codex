import type { WardIn, WardListItemOut } from "./generated/it_console";
export const canCloseWard = (ward: WardListItemOut) =>
  ward.beds_in_use.length === 0 && ward.waitlisted === 0;
export const wardBody = (w: WardListItemOut): WardIn => ({
  code: w.code,
  name: w.name,
  ward_type: w.ward_type,
  gender_restriction: w.gender_restriction,
  department_id: w.department_id,
  room_charge_service_id: w.room_charge_service_id,
  is_active: w.is_active,
});
