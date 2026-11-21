"""Bundle the federal parking inventory as a dated fallback, not live availability."""
import json,pathlib,urllib.request,urllib.parse,datetime,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
URL='https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Truck_Stop_Parking/FeatureServer/0/query'
def main():
 rows=[]
 for offset in range(0,20000,2000):
  params={'where':'1=1','outFields':'*','f':'json','resultOffset':offset,'resultRecordCount':2000,'orderByFields':'OBJECTID','outSR':4326}
  data=json.load(urllib.request.urlopen(URL+'?'+urllib.parse.urlencode(params),timeout=25))
  if 'error' in data:raise ValueError('Inventory request failed')
  for f in data.get('features',[]):
   a=f['attributes'];name=a.get('nhs_rest_stop') or 'Truck parking inventory site';categories=['parking']
   if re.search(r'weigh|scale|port of entry|\bpoe\b',name,re.I):categories+=['weigh']
   elif re.search(r'rest|welcome|visitor|service plaza|turnout|wayside',name,re.I):categories+=['rest']
   # Unclassified public parking is not assumed to be a commercial truck stop.
   rows.append({'type':'inventory','id':a['OBJECTID'],'lat':a['latitude'],'lon':a['longitude'],'categories':categories,'tags':{'name':name,'hgv':'yes','source':'FHWA/BTS parking inventory (2019 survey; confirm site)','description':a.get('highway_route') or ''}})
  if not data.get('exceededTransferLimit'):break
 if not rows:raise ValueError('Empty inventory')
 (ROOT/'data/parking-inventory.json').write_text(json.dumps({'source':URL,'surveyYear':2019,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'elements':rows},separators=(',',':')))
 print('Inventory sites:',len(rows),'categories:',{c:sum(c in r['categories'] for r in rows) for c in ['parking','weigh','rest','stops']})
if __name__=='__main__':main()
