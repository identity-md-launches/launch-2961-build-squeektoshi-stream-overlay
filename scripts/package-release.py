"""Build a static release and two small allowlisted archives. No runtime dependencies."""
from pathlib import Path
import hashlib,json,subprocess,zipfile,datetime,shutil
ROOT=Path(__file__).resolve().parent.parent
source=ROOT/'src'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
files={str(p.relative_to(source)):sha(p) for p in sorted(source.rglob('*')) if p.is_file() and p.name!='build.json'}
build_id=hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()
VERSION='2.0.2'
# The only version a visitor sees is the configurator label; refuse to package a mismatch.
label=(source/'assets'/'configurator.js').read_text()
if f"'Version {VERSION} · " not in label or f"'Sürüm {VERSION} · " not in label:raise SystemExit('configurator version label does not match '+VERSION)
metadata={'version':VERSION,'buildId':build_id,'basedOnCommit':'25586cb70773f31fa89e369c2bc569c81139ef25','builtAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'hostingName':'squeektoshi-stream-overlay-obs-a.identitymd.eth','runtimeFiles':files}
(source/'build.json').write_text(json.dumps(metadata,indent=2)+'\n')
subprocess.run(['node','scripts/build.mjs'],cwd=ROOT,check=True)
artifacts=ROOT/'artifacts';artifacts.mkdir(exist_ok=True)
source_paths=[]
for name in ['src','scripts','tests','types','LICENSES']:
 source_paths.extend(p for p in (ROOT/name).rglob('*') if p.is_file() and 'node_modules' not in p.parts)
for name in ['package.json','package-lock.json','tsconfig.json','tooling.lock.json','README.md','VALIDATION.md','DESIGN.md','SCHEMA.md','CHANGELOG.md','NOTICE.md','PATH_BUDGET.md','.gitignore']:
 if (ROOT/name).is_file():source_paths.append(ROOT/name)
# Stable paths and timestamps; never recursively zip artifacts or either ZIP itself.
def archive(target,items,base):
 with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for path in sorted(items):
   name=path.relative_to(base).as_posix();info=zipfile.ZipInfo(name,date_time=(2026,11,6,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o644<<16;z.writestr(info,path.read_bytes())
archive(artifacts/'squeektoshi-source.zip',source_paths,ROOT)
archive(artifacts/'squeektoshi-static.zip',[p for p in (ROOT/'dist').rglob('*') if p.is_file()],ROOT/'dist')
downloads=ROOT/'dist'/'downloads';downloads.mkdir(exist_ok=True)
for name in ['squeektoshi-source.zip','squeektoshi-static.zip']:shutil.copyfile(artifacts/name,downloads/name)
(artifacts/'build.json').write_text(json.dumps(metadata,indent=2)+'\n')
print(json.dumps({'version':metadata['version'],'buildId':build_id,'sourceZipBytes':(artifacts/'squeektoshi-source.zip').stat().st_size,'staticZipBytes':(artifacts/'squeektoshi-static.zip').stat().st_size}))
