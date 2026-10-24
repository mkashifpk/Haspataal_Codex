// Reconcile the exact stopped test profile; never logs in again or repeats business writes.
import {_electron as electron} from 'playwright';
import {terminalPage} from './terminal-page.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const file='artifacts/referral-check.json',j=JSON.parse(fs.readFileSync(file));
const profile=path.resolve('artifacts/referral-check-profile-1792777263503');
assert(profile.startsWith(path.resolve('artifacts')+path.sep));assert(fs.existsSync(profile));
const env={...process.env,HASPATAAL_TEST:'1',HASPATAAL_DEV_CONFIG:path.resolve('.dev-terminal.json'),HASPATAAL_TEST_DATA:profile};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try{
 const p=await terminalPage(app);await p.locator('body').waitFor();
 const native=async(action,args)=>{const r=await p.evaluate(v=>window.terminal.call(v.action,v.args),{action,args});assert(r.ok,`${action}: ${r.error?.code}`);return r.data};
 await p.getByText('Hospital server ready.',{exact:true}).waitFor({timeout:60000});
 const state=await native('state');assert.equal(state.user,null);
 // Auth is intentionally memory-only at startup. Server preference equality was separately verified by MCP GETauth/me.
 const token=path.join(profile,'session.enc');assert(token.startsWith(path.resolve('artifacts')+path.sep));if(fs.existsSync(token))fs.unlinkSync(token);
 j.preferences_restored=true;j.finished=new Date().toISOString();j.recovery='Exact stopped profile verified locally signed out on restart (auth is memory-only), ignored stopped-profile encrypted credential file removed without reading; no business writes. MCP GETauth/me separately verified original en/Light/100/Separate/empty-extra unchanged; original referral1 Cancelled read200 requestc962dd065d684afd9f6e2e6bd22fdbd9, acknowledgement null. Old crashed server session was not explicitly revoked; no token read or reused.';fs.writeFileSync(file,JSON.stringify(j,null,2));console.log('PASS stopped exact profile locally signed out/credential file cleared; server preferences independently verified');
}finally{await app.close()}
