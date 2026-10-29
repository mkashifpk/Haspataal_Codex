const allowed=['cost_estimates_admissions','cost_estimates_billing','explain_estimate'];
function estimateView(screenId,est){if(!allowed.includes(screenId))throw Error('Invalid estimate workspace');return est.views.screens.find(s=>s.screen_id===screenId)?.view??(screenId!=='cost_estimates_admissions'?'full':undefined);}
module.exports={estimateView};
