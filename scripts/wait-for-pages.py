"""Avoid a branch-based Pages deployment overwriting freshly generated snapshots."""
import json,os,time,urllib.request
url='https://api.github.com/repos/'+os.environ['GITHUB_REPOSITORY']+'/actions/runs?head_sha='+os.environ['GITHUB_SHA']+'&per_page=30'
for attempt in range(24):
    request=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
    with urllib.request.urlopen(request,timeout=15) as response:runs=json.load(response)['workflow_runs']
    branch=[r for r in runs if r['name']=='pages build and deployment']
    if branch and all(r['status']=='completed' for r in branch):
        print('Built-in publisher finished; refreshed reports will publish afterward.');break
    if not branch and attempt>=6:
        print('No built-in publisher found; continuing.');break
    time.sleep(10)
else:
    raise SystemExit('Built-in publisher is still running; stop rather than race its deployment.')
