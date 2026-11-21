"""Fetch public USDOT-registered work-zone feeds. Never represent these as full traffic coverage."""
import concurrent.futures,datetime,json,pathlib,urllib.request,urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
NOW=datetime.datetime.now(datetime.timezone.utc)
STAMP=NOW.isoformat()
REGISTRY='https://data.transportation.gov/resource/69qe-yiui.json?$limit=500'
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':'DustinsTruckin/1.0 (+https://aeralabs.github.io/Dustin-s-truckin/)','Accept':'application/json'})
    with urllib.request.urlopen(req,timeout=18) as r:
        raw=r.read(20_000_001)
        if len(raw)>20_000_000:raise ValueError('Feed too large')
        return json.loads(raw)
def date(value):
    try:return datetime.datetime.fromisoformat(value.replace('Z','+00:00')).astimezone(datetime.timezone.utc)
    except (ValueError,TypeError,AttributeError):return None
def compact(geometry):
    def points(coords):
        # Bound payload size while retaining the first/last position. Display is an approximate report footprint.
        if len(coords)>80:
            coords=[coords[round(i*(len(coords)-1)/79)] for i in range(80)]
        return [[round(float(v[0]),5),round(float(v[1]),5)] for v in coords]
    kind=geometry['type'];c=geometry['coordinates']
    if kind=='Point':c=points([c])[0]
    elif kind in ['MultiPoint','LineString']:c=points(c)
    elif kind in ['MultiLineString','Polygon']:c=[points(line) for line in c]
    elif kind=='MultiPolygon':c=[[points(line) for line in polygon] for polygon in c]
    return {'type':kind,'coordinates':c}
def normalize(feature):
    p=feature.get('properties') or {};core=p.get('core_details') or p
    end=date(p.get('end_date'));start=date(p.get('start_date'))
    if end and end<NOW:return None
    # Do not mark future works as active closures.
    if start and start>NOW:return None
    geometry=feature.get('geometry')
    if not geometry or geometry.get('type') not in ['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon']:return None
    return {'type':'Feature','geometry':compact(geometry),'properties':{'id':str(feature.get('id','')),'name':', '.join(core.get('road_names') or []) or 'Reported roadwork','description':core.get('description') or 'Work-zone report','direction':core.get('direction') or 'unspecified','closed':p.get('vehicle_impact')=='all-lanes-closed','updatedAt':core.get('update_date'),'start':p.get('start_date'),'end':p.get('end_date'),'impact':p.get('vehicle_impact','unknown')}}
def load_feed(row):
    url=row['url']['url']
    try:
        data=fetch(url)
        if not isinstance(data.get('features'),list):raise ValueError('Unsupported feed schema')
        info=data.get('road_event_feed_info') or data.get('feed_info') or {}
        feed_time=info.get('update_date')
        items=[v for f in data['features'] if (v:=normalize(f))]
        return {'source':row.get('issuingorganization'), 'feed':row.get('feedname'),'status':'downloaded','retrievedAt':STAMP,'feedUpdatedAt':feed_time,'features':items}
    except Exception as e:
        return {'source':row.get('issuingorganization'),'feed':row.get('feedname'),'status':'unavailable','error':type(e).__name__,'features':[]}
def main():
    directory=json.loads((ROOT/'data/state-sources.json').read_text())
    try:registry=fetch(REGISTRY)
    except Exception:registry=json.loads((ROOT/'data/wzdx-registry.json').read_text())
    active=[r for r in registry if r.get('active') and r.get('url',{}).get('url','').startswith('https://')]
    public=[r for r in active if not r.get('needapikey') and any(s.lower() in str(r.get('state','')).lower().split(', ') for s in directory)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:results=list(pool.map(load_feed,public))
    for name,record in directory.items():
        matches=[i for i,r in enumerate(public) if name.lower() in str(r.get('state','')).lower().split(', ')]
        feeds=[results[i] for i in matches]
        entries=[]
        for feed in feeds:
            for feature in feed['features']:
                feature={**feature,'properties':{**feature['properties'],'source':feed['source'],'retrievedAt':feed.get('retrievedAt'),'feedUpdatedAt':feed.get('feedUpdatedAt')}}
                entries.append(feature)
        data={'type':'FeatureCollection','state':name,'checkedAt':STAMP,'coverage':'work-zones-only','feeds':[{k:v for k,v in f.items() if k!='features'} for f in feeds],'requiresKey':any(r.get('needapikey') and name.lower() in str(r.get('state','')).lower().split(', ') for r in active),'features':entries}
        target=ROOT/'data/roads'/f"{record['code']}.json"
        target.write_text(json.dumps(data,separators=(',',':')))
    print(json.dumps({'publicFeeds':len(public),'downloaded':sum(r['status']=='downloaded' for r in results),'features':sum(len(r['features']) for r in results),'checkedAt':STAMP}))
if __name__=='__main__':main()
