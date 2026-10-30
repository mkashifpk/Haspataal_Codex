import { ConsentsAdmissions } from "./ConsentsAdmissions";
import type { ClinicalUser } from "../clinical-context";
import type { EstablishmentOut } from "../generated/facility_profile";

export function ConsentsWard(props: {
  user: ClinicalUser;
  establishment: EstablishmentOut;
  connected: boolean;
  stream: string;
  timeZone?: string;
}) {
  return <ConsentsAdmissions {...props} screenId="consents_ward" />;
}
