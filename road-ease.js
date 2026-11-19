/* Dustin's Trucking — accessible roadside-prep shortcuts.
   These controls are for pre-trip use or while safely parked, not operating the app while moving. */
(function(){
"use strict";
const PREF_KEY="dustins-ease-v1";
const el=id=>document.getElementById(id);
const stored=()=>{try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}")}catch{return{}}};
let comfortable=stored().comfortable!==false; // easy-read control size is the default
let speaking=false;
function persist(){try{localStorage.setItem(PREF_KEY,JSON.stringify({comfortable}))}catch{}}
function notice(message){
 const status=el("road-ease-message");if(status){status.hidden=!message;status.textContent=message||""}
}
function panelClose(id){
 const panel=el(id);if(!panel)return;
 const heading=panel.querySelector(".alerts-heading");
 if(!heading||heading.querySelector(".road-panel-close"))return;
 const button=document.createElement("button");
 button.type="button";button.className="road-panel-close";button.textContent="×";
 button.setAttribute("aria-label",id==="road-inspector"?"Close road details":"Close state conditions");
 button.addEventListener("click",()=>{panel.hidden=true});
 heading.appendChild(button);
}
function savedTrips(){
 try{return typeof saved==="function"?saved():[]}catch{return[]}
}
function recentTrip(){
 const items=savedTrips(),t=items[0];
 if(!t){openPlanner();notice("No saved trips yet. Plan a route and choose Save Trip to use this shortcut next time.");return}
 if(!t.a?.name||!t.b?.name){notice("That saved trip is missing a location. Open Trips to create a new one.");return}
 el("origin-input").value=t.a.name;
 el("destination-input").value=t.b.name;
 openPlanner();
 el("route-message").textContent="Latest saved trip loaded. Tap Check Route Weather to update its forecast. Truck clearance is not verified.";
 notice("");
 el("destination-input").blur();
}
function openPlanner(){
 const b=document.querySelector('.cockpit-tab[data-mode="trips"]');
 if(b)b.click();
 else el("route-form")?.scrollIntoView({block:"nearest"});
}
function checkCenter(){
 if(!state.map){notice("Map is loading. Try again shortly.");return}
 const c=state.map.getCenter();
 if(!Number.isFinite(c.lat)||!Number.isFinite(c.lng)){notice("Choose an area on the map first.");return}
 el("map-sheet")?.setAttribute("hidden","");
 el("map-dock")?.classList.remove("is-hidden");
 document.querySelector('.cockpit-tab[data-mode="places"]')?.setAttribute("aria-pressed","true");
 document.querySelector('.cockpit-tab[data-mode="trips"]')?.setAttribute("aria-pressed","false");
 notice("Checking map center for local weather and official alerts. Reported closures depend on available state 511 data.");
 // Uses existing weather, NWS and optional official 511 inspection. No location data is inferred from taps.
 inspectRoadSegment(c).catch(error=>notice("Could not load the check: "+(error.message||"data unavailable")));
}
function toggleComfort(){
 comfortable=!comfortable;
 setComfort();
 persist();
}
function setComfort(){
 document.body.classList.toggle("road-comfort",comfortable);
 const b=el("road-comfort-toggle");
 if(!b)return;
 b.setAttribute("aria-pressed",String(comfortable));
 b.innerHTML='<span aria-hidden="true">◫</span> '+(comfortable?"Large on":"Large off");
 b.setAttribute("aria-label",comfortable?"Turn off larger controls":"Turn on larger controls");
}
function infoText(id){return (el(id)?.textContent||"").trim().replace(/\s+/g," ")}
function briefingText(){
 if(!state.route||el("route-results")?.hidden)return"Plan and check a trip first to hear a route weather briefing.";
 const title=infoText("route-title")||"Selected trip";
 const miles=infoText("route-distance"),duration=infoText("route-duration");
 const condition=infoText("risk-title"),description=infoText("risk-description");
 const count=infoText("alerts-count"),alertTitle=infoText("alerts-title");
 const parts=["Dustin's Trucking trip briefing.",title+"; "+miles+"; estimated "+duration.replace("*","")+"."]; 
 if(condition)parts.push(condition+". "+description+".");
 if(count&&!["—","-","…"].includes(count)&&/^\d+$/.test(count))parts.push(count+" alerts reported at sampled route locations.");
 else if(/checking/i.test(alertTitle))parts.push("The official weather-alert check is still in progress.");
 else parts.push("Confirm current official weather alerts before departure.");
 parts.push("Weather data may be delayed or incomplete. This is not verified commercial truck navigation, traffic or road-clearance guidance. Review posted signs and state D O T advisories.");
 return parts.join(" ");
}
function speakBriefing(){
 if(!("speechSynthesis"in window)||!("SpeechSynthesisUtterance"in window)){notice("Speech playback is not supported in this browser. You can still view the summary.");return}
 if(speaking){window.speechSynthesis.cancel();speaking=false;updateBriefButton();return}
 const words=briefingText();
 if(!state.route){notice(words);openPlanner();return}
 window.speechSynthesis.cancel();
 const utterance=new SpeechSynthesisUtterance(words);
 utterance.lang="en-US";utterance.rate=.94;utterance.pitch=1;utterance.volume=1;
 utterance.onend=utterance.onerror=()=>{speaking=false;updateBriefButton()};
 speaking=true;updateBriefButton();
 try{window.speechSynthesis.speak(utterance)}catch{speaking=false;updateBriefButton();notice("Audio briefing could not start. Check browser settings.")}
}
function updateBriefButton(){
 const b=el("road-speak");if(!b)return;
 b.textContent=speaking?"■ Stop reading":"◖)) Read trip briefing";
 b.setAttribute("aria-label",speaking?"Stop spoken briefing":"Read a pre-trip summary aloud");
}
function refreshSummary(){
 const banner=el("map-route-banner");if(!banner)return;
 const loaded=!!state.route&&!el("route-results")?.hidden;
 banner.hidden=!loaded;
 if(!loaded)return;
 const risk=infoText("risk-indicator");
 const distance=infoText("route-distance");
 const duration=infoText("route-duration").replace("*","");
 const alerts=infoText("alerts-count");
 const summary=[risk&&risk!=="STANDBY"?risk:"WEATHER CHECKED",distance,duration, /^\d+$/.test(alerts)?alerts+" NWS alerts":""].filter(Boolean).join(" · ");
 const label=banner.querySelector("span");
 if(label)label.textContent=summary;
 const summaryPanel=el("road-summary");
 if(summaryPanel){
  summaryPanel.hidden=false;
  el("road-summary-trip").textContent=infoText("route-title");
  el("road-summary-weather").textContent=infoText("risk-title")||"Weather check complete";
  el("road-summary-details").textContent=(infoText("risk-description")||"Check conditions before leaving").slice(0,170);
 }
}
function install(){
 const dock=el("map-dock"),sheet=el("map-sheet");
 if(!dock||!sheet||el("road-ease-actions"))return;
 // Big controls are available immediately without a setup wizard.
 const actions=document.createElement("div");
 actions.className="road-ease-actions";actions.id="road-ease-actions";
 actions.setAttribute("role","group");actions.setAttribute("aria-label","Quick pre-trip shortcuts");
 actions.innerHTML='<button id="road-check-center" type="button" class="road-ease-button"><span aria-hidden="true">⊙</span> Check here</button><button id="road-last-trip" type="button" class="road-ease-button"><span aria-hidden="true">↶</span> Last trip</button><button id="road-comfort-toggle" type="button" class="road-ease-button" aria-pressed="true"><span aria-hidden="true">◫</span> Large on</button>';
 const status=document.createElement("p");status.id="road-ease-message";status.className="road-ease-message";status.setAttribute("role","status");status.setAttribute("aria-live","polite");status.hidden=true;
 dock.insertBefore(actions,dock.querySelector(".map-quick-row"));
 dock.appendChild(status);
 const body=el("map-sheet-content");
 const summary=document.createElement("section");
 summary.className="road-summary";summary.id="road-summary";summary.hidden=true;
 summary.setAttribute("aria-label","Pre-trip weather summary");
 summary.innerHTML='<div class="road-summary-row"><div><strong id="road-summary-trip"></strong><small id="road-summary-weather"></small></div><button id="road-speak" type="button" aria-label="Read pre-trip summary aloud">◖)) Read trip briefing</button></div><p id="road-summary-details"></p><p class="road-safety-note">Before departure only · road restrictions and actual pavement conditions are not verified</p>';
 // The trip drawer always contains the summary, even if a route hasn't been calculated.
 body.insertBefore(summary,body.firstChild);
 el("road-check-center").addEventListener("click",checkCenter);
 el("road-last-trip").addEventListener("click",recentTrip);
 el("road-comfort-toggle").addEventListener("click",toggleComfort);
 el("road-speak").addEventListener("click",speakBriefing);
 panelClose("state-overview");panelClose("road-inspector");
 setComfort();
 const routeResults=el("route-results");
 if(routeResults)new MutationObserver(refreshSummary).observe(routeResults,{attributes:true,attributeFilter:["hidden"]});
 for(const id of ["route-title","route-distance","route-duration","risk-title","risk-description","risk-indicator","alerts-count"]){
  const target=el(id);if(target)new MutationObserver(refreshSummary).observe(target,{childList:true,characterData:true,subtree:true});
 }
 const banner=el("map-route-banner");
 if(banner)new MutationObserver(()=>{if(state.route&&!routeResults?.hidden){const label=banner.querySelector("span");if(label&&!label.textContent.includes("NWS alerts")&&label.textContent.startsWith("Route ready"))refreshSummary()}}).observe(banner,{attributes:true,attributeFilter:["hidden"]});
 refreshSummary();
 document.addEventListener("visibilitychange",()=>{if(document.hidden&&speaking){window.speechSynthesis?.cancel();speaking=false;updateBriefButton()}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();