"""Reproduce the source build in disposable scratch; do not copy installed packages."""
from pathlib import Path
import subprocess,shutil,json,time,zipfile,hashlib
root=Path(__file__).resolve().parent.parent
clean=root/'test/scratch/clean-source'
if clean.exists():shutil.rmtree(clean)
clean.mkdir(parents=True)
archive=root/'artifacts/squeektoshi-source.zip'
with zipfile.ZipFile(archive) as z:
 for name in z.namelist():
  if Path(name).is_absolute() or '..' in Path(name).parts:raise SystemExit('Unsafe archive entry')
 z.extractall(clean)
tsc=root/'test/scratch/tools/node_modules/typescript/bin/tsc'
commands=[(['npm','ci','--ignore-scripts','--cache',str(root/'test/scratch/npm-cache')],'npm ci --ignore-scripts'),(['npm','run','build'],'npm run build'),(['node',str(tsc),'-p','tsconfig.json'],'locked TypeScript 5.9.3: tsc -p tsconfig.json'),(['node','--test','tests/logic.test.cjs','tests/regressions.test.cjs'],'node --test tests/logic.test.cjs tests/regressions.test.cjs')]
results=[]
for args,label in commands:
 started=time.monotonic();p=subprocess.run(args,cwd=clean,capture_output=True,text=True)
 # Store useful check output, not machine paths or package-manager environment notices.
 lines=[line.replace(str(root),'<repository>') for line in p.stdout.splitlines() if not line.startswith('npm ')][-12:]
 results.append({'command':label,'exitCode':p.returncode,'durationMs':round((time.monotonic()-started)*1000),'output':'\n'.join(lines)})
 if p.returncode:break
mismatches=[]
for path in (root/'src').rglob('*'):
 if path.is_file():
  target=clean/'dist'/path.relative_to(root/'src')
  if not target.exists() or path.read_bytes()!=target.read_bytes():mismatches.append(str(path.relative_to(root/'src')))
report={'passed':all(x['exitCode']==0 for x in results) and len(results)==4 and not mismatches,'sourceArchive':'artifacts/squeektoshi-source.zip','archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'commands':results,'runtimeFileCount':sum(p.is_file() for p in (root/'src').rglob('*')),'mismatches':mismatches,'copiedDependencies':False}
(root/'artifacts/clean-source-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if not report['passed']:raise SystemExit(1)
