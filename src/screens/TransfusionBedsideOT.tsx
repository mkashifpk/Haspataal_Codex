import React from "react";
import { TransfusionBedside, type TransfusionBedsideProps } from "./TransfusionBedside";

export function TransfusionBedsideOT(props: Omit<TransfusionBedsideProps, "screenId">) {
  return <TransfusionBedside {...props} screenId="transfusion_bedside_ot" />;
}
