const allowed=['cost_estimates_admissions','cost_estimates_billing'];
function estimateView(screenId,est){if(!allowed.includes(screenId))throw Error('Invalid estimate workspace');return est.views.screens.find(s=>s.screen_id===screenId)?.view??(screenId==='cost_estimates_billing'?'full':undefined);}
module.exports={estimateView};
