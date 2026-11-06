// Install exact development tools only into disposable scratch. Root dependencies stay untouched.
import {readFile,mkdir} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
const lock=JSON.parse(await readFile(new URL('../tooling.lock.json',import.meta.url),'utf8'));
const packages=lock.packages.filter(p=>p.name!=='playwright-core').map(p=>`${p.name}@${p.version}`);
await mkdir('test/scratch/tools',{recursive:true});
const result=spawnSync('npm',['install','--prefix','test/scratch/tools','--cache','test/scratch/npm-cache','--no-save','--no-package-lock','--ignore-scripts',...packages],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const installedLock=JSON.parse(await readFile('test/scratch/tools/node_modules/.package-lock.json','utf8'));
for(const p of lock.packages){if(installedLock.packages['node_modules/'+p.name]?.integrity!==p.integrity)throw Error('Tool integrity mismatch: '+p.name);const actual=JSON.parse(await readFile(`test/scratch/tools/node_modules/${p.name}/package.json`,'utf8'));if(actual.version!==p.version)throw Error('Tool version mismatch: '+p.name);}
console.log('Tools installed in test/scratch/tools. Install a browser with its Playwright CLI if needed.');
