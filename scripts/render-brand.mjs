import fs from 'node:fs';
import sharp from 'sharp';
const manifest=JSON.parse(fs.readFileSync(new URL('../public/brand/manifest.json',import.meta.url)));
for(const item of manifest){
 const path=new URL('../public/brand/'+item.name,import.meta.url).pathname;
 const width=item.layout==='horizontal'?3840:2048;
 await sharp(path+'.svg').resize({width}).png().toFile(path+'.png');
 if(item.background==='solid')await sharp(path+'.svg').resize({width}).flatten({background:item.solidColor}).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toFile(path+'.jpg');
}
