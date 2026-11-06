"""Check submitted-path bytes and archive contents without changing Git metadata."""
from pathlib import Path
import subprocess,json,hashlib,zipfile
root=Path(__file__).resolve().parent.parent
files=set(subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0'))|set(subprocess.check_output(['git','ls-files','--others','--exclude-standard','-z'],cwd=root).decode().split('\0'))
files=sorted(f for f in files if f and (root/f).is_file() and not f.startswith(('.imd/','test/scratch/')))
for f in files:
 parts=Path(f).parts
 if any(p in parts for p in ['node_modules','.cache','npm-cache','.git']):raise SystemExit('Generated path in submission: '+f)
 if f.endswith('.tgz'):raise SystemExit('Unnecessary npm archive: '+f)
protected=['package.json','package-lock.json','tsconfig.json','scripts/build.mjs','scripts/preview.mjs','tests/logic.test.cjs']
protected_checks=[]
for f in protected:
 base=subprocess.check_output(['git','show','HEAD:'+f],cwd=root)
 same=base==(root/f).read_bytes();protected_checks.append({'path':f,'unchanged':same,'sha256':hashlib.sha256(base).hexdigest()})
 if not same:raise SystemExit('Protected/original file changed: '+f)
archives=[]
for name in ['squeektoshi-source.zip','squeektoshi-static.zip']:
 with zipfile.ZipFile(root/'artifacts'/name) as z:
  entries=z.namelist()
  bad=[n for n in entries if any(p in Path(n).parts for p in ['node_modules','.git','.github','.cache','.imd']) or Path(n).name.startswith('.env') or n.endswith('.tgz')]
  if bad:raise SystemExit('Forbidden archive paths: '+str(bad))
  if z.testzip():raise SystemExit('Corrupt ZIP: '+name)
  archives.append({'name':name,'entries':len(entries),'bytes':(root/'artifacts'/name).stat().st_size,'sha256':hashlib.sha256((root/'artifacts'/name).read_bytes()).hexdigest(),'badPaths':bad})
inventory=[{'path':f,'bytes':(root/f).stat().st_size} for f in files if f!='artifacts/bundle-budget.json']
total=sum(x['bytes'] for x in inventory)
report={'limitBytes':8388608,'measuredBytesExcludingThisReport':total,'reportAllowanceBytes':32768,'passesWithReportAllowance':total+32768<8388608,'scope':'Entire tracked plus nonignored source/artifact file set; stricter than added bytes only','protectedUnchanged':protected_checks,'archives':archives,'files':inventory}
(root/'artifacts/bundle-budget.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'bytesWithReportAllowance':total+32768,'limit':8388608,'files':len(inventory),'pass':report['passesWithReportAllowance']}))
if not report['passesWithReportAllowance']:raise SystemExit(1)
