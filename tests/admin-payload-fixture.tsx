// Isolated real form: captures its submit payload; no bridge/backend operations.
import {useState} from 'react';import {createRoot} from 'react-dom/client';import {AdminForm,adminRequestBody} from '../src/screens/ITConsole';
function Fixture(){const [data,setData]=useState<any>();(window as any).setAdminCase=(v:any)=>{(window as any).adminCaptured=undefined;setData(v);};return data?<AdminForm key={data.action.endpoint} {...data} onSubmit={(body:any)=>{(window as any).adminCaptured={submitted:true,body:adminRequestBody(data.action.endpoint,body)};}} onCancel={()=>setData(undefined)}/>:<p>Ready for form case</p>;}
createRoot(document.getElementById('root')!).render(<Fixture/>);
