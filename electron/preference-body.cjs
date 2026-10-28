// updated_at belongs to the read model, never to PUT /settings/me.
function preferenceBody(value){const {updated_at,...body}=value;return body;}
module.exports={preferenceBody};
