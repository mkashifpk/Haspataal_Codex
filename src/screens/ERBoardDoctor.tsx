import { ERBoard, type ERBoardProps } from "./ERBoard";

export function ERBoardDoctor(props: ERBoardProps) {
  return <ERBoard {...props} screenId="er_board_doctor" />;
}

export default ERBoardDoctor;
