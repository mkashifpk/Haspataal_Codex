// Only labels received directly from the authenticated backend may reach a printer.
function createDoseLabelCache(){
 const rows=new WeakMap();
 return {
  clear(owner){rows.delete(owner)},
  remember(owner,actor,path,payload){
   const match=path.match(/^\/mar\/(\d+)\/prepare$/);if(!match)return;
   if(payload?.document_type!=='dose_label'||payload.printer_role!=='label'||payload.fields?.mar_id!==Number(match[1])||!payload.fields.mrn||!payload.fields.prepared_at||!payload.fields.drug_name||typeof payload.text!=='string')throw Error('Unexpected dose-label response');
   let list=rows.get(owner);if(!list)rows.set(owner,list=new Map());list.set(Number(match[1]),{actor,payload:structuredClone(payload)});
  },
  read(owner,actor,id){const value=rows.get(owner)?.get(id);if(!value||value.actor!==actor)throw Error('The original preparation label is unavailable in this session. Do not prepare again just to print; ask the responsible team to reconcile.');return structuredClone(value.payload)}
 };
}
module.exports={createDoseLabelCache};
