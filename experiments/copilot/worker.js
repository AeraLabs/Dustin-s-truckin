// A dedicated worker keeps CPU inference off the map's UI thread. No inference server.
let generator;
self.onmessage=async({data})=>{
 try{
  if(data.type==='load'){
   const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
   env.allowLocalModels=false;
   env.useBrowserCache=false;
   env.useCustomCache=true;
   env.customCache=await caches.open('rigahead-copilot-model-v1');
   env.backends.onnx.wasm.numThreads=1;
   generator=await pipeline('text-generation','HuggingFaceTB/SmolLM2-135M-Instruct',{
    revision:'12fd25f77366fa6b3b4b768ec3050bf629380bac',device:'wasm',dtype:'q4',
    progress_callback:p=>self.postMessage({type:'progress',text:p.status==='progress'?`Downloading ${p.file}: ${Math.round(p.progress||0)}%`:p.status})
   });
   self.postMessage({type:'ready'});
  }else if(data.type==='command'&&generator){
   const result=await generator([
    {role:'system',content:'Classify a single app command. Reply ONLY with one label from: light, dark, zoom_in, zoom_out, parking, stops, rest, weigh, clear_pins, trips, map, sources, conditions, unknown. Conditions means open weather panel, not answer a road question. Questions about road safety, closures, routes, directions, multiple actions, or anything else must be unknown. Examples: Make it brighter => light. Find somewhere to park my truck => parking. Is I-84 safe? => unknown.'},
    {role:'user',content:data.text}
   ],{max_new_tokens:12,do_sample:false,return_full_text:false});
   const generated=result[0].generated_text;
   const text=Array.isArray(generated)?generated.at(-1).content:generated;
   self.postMessage({type:'result',id:data.id,text});
  }
 }catch(error){self.postMessage({type:'error',text:error.message||'Local model failed.'})}
};
