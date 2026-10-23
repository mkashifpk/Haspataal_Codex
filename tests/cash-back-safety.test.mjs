import test from "node:test";
import assert from "node:assert/strict";
import {cashBackDrawerReady,cashBackReviewKey} from "../src/cash-back-safety.ts";
const drawer={user:{user_id:34},terminal:{registered:true,cash_node:"MainReception"},shift:{shift_id:4,user_id:34,node:"MainReception",status:"Open"}};
test("cash-back cannot acknowledge another actor, closed shift, missing assignment or another counter",()=>{
  assert(cashBackDrawerReady(drawer));
  for (const value of [null,{...drawer,shift:null},{...drawer,shift:{...drawer.shift,status:"PendingCollection"}},{...drawer,shift:{...drawer.shift,user_id:35}},{...drawer,terminal:{registered:true}},{...drawer,terminal:{registered:false,cash_node:"MainReception"}},{...drawer,shift:{...drawer.shift,node:"LabReception"}}]) assert.equal(cashBackDrawerReady(value),false);
});
test("physical acknowledgement belongs to exact ticket, patient, prompt, amount and own drawer",()=>{
  const ticket={ticket_id:11,patient_id:15},prompt={kind:"Refund",id:4,amount:100};
  const key=cashBackReviewKey(ticket,prompt,drawer);assert(key);
  for(const [t,p,d] of [[{...ticket,ticket_id:12},prompt,drawer],[{...ticket,patient_id:16},prompt,drawer],[ticket,{...prompt,id:5},drawer],[ticket,{...prompt,kind:"WaiverRefund"},drawer],[ticket,{...prompt,amount:200},drawer],[ticket,prompt,{...drawer,shift:{...drawer.shift,shift_id:5}}]]) assert.notEqual(cashBackReviewKey(t,p,d),key);
  for(const amount of [NaN,Infinity,0,-1])assert.equal(cashBackReviewKey(ticket,{...prompt,amount},drawer),undefined);
  assert.equal(cashBackReviewKey(ticket,prompt,null),undefined);
});
