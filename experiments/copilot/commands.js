/* The model can select only these reversible actions; it never supplies road facts. */
(function(root){
 const commands={light:'Switch to light mode',dark:'Switch to dark mode',zoom_in:'Zoom in',zoom_out:'Zoom out',parking:'Show truck parking',stops:'Show truck stops',rest:'Show rest areas',weigh:'Show weigh stations',clear_pins:'Clear place pins',trips:'Open trip planner',map:'Show map',sources:'Open official sources',conditions:'Show weather panel',unknown:'Command not supported'};
 function validate(value){const key=String(value||'').trim();return Object.hasOwn(commands,key)?key:'unknown'}
 function exact(text){const s=text.toLowerCase().trim().replace(/[.!?]+$/,'');return ({'light mode':'light','dark mode':'dark','zoom in':'zoom_in','zoom out':'zoom_out','show truck parking':'parking','show truck stops':'stops','show rest areas':'rest','show weigh stations':'weigh','clear pins':'clear_pins','open trip planner':'trips','show map':'map','open official sources':'sources','show weather':'conditions'})[s]||'unknown'}
 const api={commands,validate,exact};if(typeof module!=='undefined')module.exports=api;else root.RigCopilotCommands=api;
})(globalThis);
