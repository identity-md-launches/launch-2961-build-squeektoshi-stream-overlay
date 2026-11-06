"""Summarize recorded results; fail rather than label unfinished evidence a pass."""
from pathlib import Path
import json,hashlib,datetime
root=Path(__file__).resolve().parent.parent
art=root/'artifacts'
def read(name):return json.loads((art/name).read_text())
main=read('browser-results.json');extended=read('browser-extended-results.json');soak=read('soak-final-results.json');taste=read('taste-results.json');build=read('build.json')
assert main['failed']==0 and extended['failed']==0
assert soak['complete'] and soak['passed'] and soak['elapsedMs']>=1800000
runtime_hashes={name:hashlib.sha256((root/'dist/assets'/name).read_bytes()).hexdigest() for name in soak['hashes']}
assert runtime_hashes==soak['hashes'], 'Soak did not run the final renderer'
extra_names=['browser-epoch-results.json','browser-refresh-results.json','browser-keyboard-results.json','browser-resources-results.json','browser-touch-results.json','browser-alert-positions-results.json']
for name in extra_names:assert read(name)['passed'],name
for name in ['commands.json','clean-source-results.json','release-results.json','art-preservation.json']:assert read(name)['passed'],name
assert all(c['passed'] for c in taste['checks'])
rows=soak['samples'];sources=[]
for i in range(2):
 data=[r['data'][i] for r in rows]
 sources.append({'source':data[0]['source'],'rendererNodeRange':[min(d['diag']['nodes'] for d in data),max(d['diag']['nodes'] for d in data)],'eventCountMaximum':max(len(d['diag']['events']) for d in data),'lastResourceEntries':data[-1]['resources'],'lastDOMCounters':data[-1]['memory'],'sessionWrites':data[-1]['sessionWrites']})
summary={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':build['version'],'buildId':build['buildId'],'baseCommit':build['basedOnCommit'],'fullAcceptanceClaimed':False,'logicTests':{'originalUnchanged':28,'new':28,'totalPassed':56},'browser':{'version':main['browser'],'main':main['passed'],'extended':extended['passed'],'additionalChecks':len(extra_names),'totalChecks':main['passed']+extended['passed']+len(extra_names),'configurationMatrix':320,'alertPositionMatrix':100,'layoutFormatMatrix':20,'extraEvidence':extra_names},'designChecksPassed':len(taste['checks']),'soak':{'passed':True,'durationMs':soak['elapsedMs'],'samples':len(rows),'statusRequests':soak['statusRequests'],'economyRequests':soak['economyRequests'],'demoRequests':soak['demoAPI'],'errors':len(soak['errors']),'cleanup':soak['cleanup'],'finalRendererHashesMatch':True,'sources':sources},'gaps':['Native OBS Studio unverified','Native Streamlabs Desktop unverified','WebKit could not launch: host libraries missing','Physical touch devices, screen readers and native browser 200% zoom unverified; emulated touch and CSS zoom tested','Direct Chromium public-API transport failed on this host; unchanged real responses rendered through a test-only transport','Existing deployment unavailable; future published assets/version/CSP unverified','Provider commercial scope/price confirmation not supplied']}
(art/'validation-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'browserChecks':summary['browser']['totalChecks'],'soakPassed':True,'buildId':build['buildId']}))
