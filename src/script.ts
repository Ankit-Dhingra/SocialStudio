import OpenAI from 'openai';
import {zodTextFormat} from 'openai/helpers/zod';
import {shortSchema,type Short} from './core.js';
export async function makeScript(topic:string):Promise<Short>{
 if(process.env.DEMO_MODE==='true')return shortSchema.parse({
  title: topic && topic.trim().length >= 5 ? topic.trim().slice(0, 100) : 'How Node.js Handles 1,000 Requests',
  description:'A simple visual explanation of Node.js concurrency. Narration is AI-generated in live mode.',
  scenes:[
   {type:'hook',headline:'ONE THREAD. 1,000 REQUESTS?',narration:'How can Node.js handle thousands of connections, when JavaScript runs on one main thread?',code:'',label:'The surprising question'},
   {type:'diagram',headline:'REQUESTS ARRIVE',narration:'Requests arrive through network sockets. Node does not create one JavaScript thread for every connection.',code:'',label:'Many clients → one event loop'},
   {type:'code',headline:'ASYNC DOES NOT BLOCK',narration:'When this handler awaits the database, its execution pauses. The event loop can run other ready callbacks.',code:'app.get("/users", async (req, res) => {\n  const users = await db.users.findMany();\n  res.json(users);\n});',label:'await suspends this handler'},
   {type:'diagram',headline:'I/O COMPLETES LATER',narration:'The operating system and other services handle I O work. When results are ready, callbacks and promise continuations can resume.',code:'',label:'I/O readiness → callbacks'},
   {type:'summary',headline:'CONCURRENCY ≠ PARALLEL JS',narration:'One JavaScript thread can manage many concurrent connections. But CPU heavy JavaScript still blocks unless you offload it.',code:'',label:'One thread, many ongoing operations'}]});
 if(!process.env.OPENAI_API_KEY)throw Error('Missing OPENAI_API_KEY');
 const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
 const res=await openai.responses.parse({model:process.env.OPENAI_MODEL||'gpt-5-mini',
  input:[{role:'system',content:'You write accurate, original 40-65 second educational JavaScript/Node.js Shorts. Return 4-6 short visual scenes. Every scene must include type, headline, narration, code (empty unless code scene), label. Total narration 95-145 spoken words. Strong hook; accurate Node architecture. Avoid unverifiable claims. No markdown. Code must be concise and valid when standalone context permits.'},{role:'user',content:`Topic: ${topic}`}],
  text:{format:zodTextFormat(shortSchema,'short_script')}});
 if(!res.output_parsed)throw Error('Model returned no structured script');
 return shortSchema.parse(res.output_parsed);
}
