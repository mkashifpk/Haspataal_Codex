# Historical DEV test - retired after database reset

This source is evidence only. Rewrite it to discover/create fresh records before reactivation. Never replay old keys, IDs or event cursors.

```javascript
// Test-fixture upload only: a clearly titled synthetic PNG, never a real identity document.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {deflateSync} from 'node:zlib';
const {request,checkedRoot}=createRequire(import.meta.url)('../electron/transport.cjs');
const root='docs/backend-refresh-2026-10-30/dev/',owned=JSON.parse(fs.readFileSync(root+'roster-new-employee-result.json')).body.data;
const file=root+'roster-document-upload-result.json';assert(!fs.existsSync(file),'Reconcile original document upload before any repeat');
const config=JSON.parse(fs.readFileSync('.dev-terminal.json','utf8')),ca=checkedRoot(config.ca_pem,config.ca_fingerprint_sha256),base=config.server_urls[0]+'/api/v1';
const login=await request(base+'/auth/login',{ca,method:'POST',body:{username:'demo.hr',password:'Demo-pass-2026'}});assert.equal(login.status,200);const token=login.body.data.access_token;assert(token);
const headers={Authorization:'Bearer '+token,'X-Haspataal-Developer':'mkashif','X-Haspataal-Implementation':'1'};
const current=await request(base+`/hr/employees/${owned.employee_id}`,{ca,headers});assert.equal(current.status,200);assert.equal(current.body.data.full_name,owned.full_name);assert.equal(current.body.data.employment_status,'Draft');
const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const t=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([t,data])));return Buffer.concat([len,t,data,sum]);};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(16,0);ihdr.writeUInt32BE(16,4);ihdr[8]=8;ihdr[9]=2;
const pixels=Buffer.concat(Array.from({length:16},()=>Buffer.from([0,...Array.from({length:16},()=>[255,0,0]).flat()])));
const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('tEXt',Buffer.from('Description\0DEMO SYNTHETIC TEST FIXTURE ONLY - NOT AN IDENTITY DOCUMENT')),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
const title='DEMO SYNTHETIC FIXTURE ONLY - NOT A REAL CNIC';
const key='SCN-Codex-1030-mvu9bpk9-roster-cnic-fixture';
fs.writeFileSync(root+'roster-document-upload-intent.json',JSON.stringify({method:'POST',path:`/hr/employees/${owned.employee_id}/documents`,as_user:'demo.hr',idempotency_key:key,doc_type:'CNIC',title,filename:'DEMO_NOT_AN_ID.png',size_bytes:bytes.length,note:'Multipart setup through real pinned transport because sandbox_call has no file argument. Public demo login remains in memory and is not journalled.'},null,2));
const result=await request(base+`/hr/employees/${owned.employee_id}/documents`,{ca,method:'POST',headers:{...headers,'Idempotency-Key':key},body:{__multipart:[{name:'doc_type',value:'CNIC'},{name:'title',value:title},{name:'file',filename:'DEMO_NOT_AN_ID.png',type:'image/png',bytes}]}});
fs.writeFileSync(file,JSON.stringify({status:result.status,body:result.body},null,2));assert.equal(result.status,201,JSON.stringify(result.body?.error));console.log(JSON.stringify({status:result.status,request_id:result.body.request_id,document_id:result.body.data.document_id}));
await request(base+'/auth/logout',{ca,method:'POST',headers});

```
