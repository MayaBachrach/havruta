// Accept both the Next CLI and managed preview's Vite-style host flags.
import { spawn } from 'node:child_process';
const preview=process.argv.includes('--strictPort');
const args=process.argv.slice(2).flatMap(arg=>arg==='--strictPort'?[]:arg==='--host'?['--hostname']:[arg]);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next',preview?'start':'dev',...args],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
