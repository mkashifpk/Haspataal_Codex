// Component regression fixture using a real current DEV refusal, no server writes.
import {useState} from 'react';import {createRoot} from 'react-dom/client';
import {ErrorBox,Field} from '../src/components';import {ApiError} from '../src/bridge';
import refusal from '../docs/evening-retest/013-short-bed-reason-result.json';
function Fixture(){const [error,setError]=useState<unknown>(new ApiError({ok:false,data:null,status:refusal.status,request_id:refusal.request_id,error:refusal.body.error})),[reason,setReason]=useState('DEMO retained reason');return <main><ErrorBox error={error}/><form><Field label="Bed service reason"><textarea data-field="reason admission_reason" value={reason} onChange={e=>setReason(e.target.value)}/></Field><Field label="Unrelated name"><input name="name" value="DEMO unrelated" readOnly/></Field><button type="button" onClick={()=>setError(undefined)}>Clear refusal</button></form></main>;}createRoot(document.getElementById('root')!).render(<Fixture/>);
