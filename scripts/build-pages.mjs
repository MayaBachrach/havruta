// Build an isolated static copy: the server checkout and its API are never modified.
import {cpSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=process.cwd(),stage=resolve(root,'.pages-build');
rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});
for(const path of ['src','public','tsconfig.json','package.json','package-lock.json']){
 try{cpSync(resolve(root,path),resolve(stage,path),{recursive:true});}catch(e){if(path!=='public')throw e;}
}
rmSync(resolve(stage,'src/app/api'),{recursive:true,force:true});
const base=process.env.PAGES_BASE_PATH||'/havruta';
if(!/^\/[a-zA-Z0-9_-]+$/.test(base))throw new Error('Invalid Pages base path');
writeFileSync(resolve(stage,'next.config.mjs'),`export default {output:'export',basePath:${JSON.stringify(base)},trailingSlash:true,images:{unoptimized:true}};\n`);
const result=spawnSync(process.execPath,[resolve(root,'node_modules/next/dist/bin/next'),'build'],{cwd:stage,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_STATIC_MODE:'true',NEXT_TELEMETRY_DISABLED:'1'}});
if(result.status!==0)process.exit(result.status||1);
rmSync(resolve(root,'out'),{recursive:true,force:true});cpSync(resolve(stage,'out'),resolve(root,'out'),{recursive:true});writeFileSync(resolve(root,'out/.nojekyll'),'');
