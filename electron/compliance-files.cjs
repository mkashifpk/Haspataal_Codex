function checkedScan(bytes, type) {
  const mime = String(type).split(';')[0].trim().toLowerCase();
  const pdf = mime === 'application/pdf' && bytes.subarray(0,5).equals(Buffer.from('%PDF-'));
  const png = mime === 'image/png' && bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
  const jpeg = mime === 'image/jpeg' && bytes.length>=3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if(!pdf&&!png&&!jpeg)throw new Error('The scan content does not match a supported PDF, PNG or JPEG. No file was opened or saved.');
  return {type:mime,extension:pdf?'pdf':png?'png':'jpg'};
}
module.exports={checkedScan};
