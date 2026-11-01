import { ERVisit, type ERVisitProps } from "./ERVisit";

export function ERVisitDoctor(props: ERVisitProps) {
  return <ERVisit {...props} screenId="er_visit_doctor" />;
}

export default ERVisitDoctor;
