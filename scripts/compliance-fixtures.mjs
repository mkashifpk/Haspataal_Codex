// Valid synthetic PNG fixture (no scanned real document or patient data).
import {deflateSync} from 'node:zlib';
export function syntheticScanPng(){
 const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const name=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([size,name,data,crc]);};
 const width=128,height=64,header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
 const rows=Buffer.alloc(height*(1+width*3),255);for(let y=0;y<height;y++)rows[y*(1+width*3)]=0;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('tEXt',Buffer.from('Comment\0SCN160 SYNTHETIC TEST ONLY - NO ACTUAL LICENCE')),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
