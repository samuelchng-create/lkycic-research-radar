import fs from 'node:fs/promises';
import {defaults,seeds,scan,html} from '../worker/index.js';
const projects=JSON.parse(await fs.readFile('projects.json','utf8'));
let prior={items:seeds,checks:[]};try{prior=JSON.parse(await fs.readFile('site/data.json','utf8'))}catch{}
const map=new Map(prior.items.map(i=>[i.project+'|'+i.id,i]));
const checks=[];
if(!process.argv.includes('--offline'))for(const p of projects){const result=await scan(p);checks.push({project:p.id,...result,items:undefined});for(const i of result.items){i.key=p.id+'|'+i.id;map.set(i.key,{...map.get(i.key),...i});}}
await fs.mkdir('site',{recursive:true});
const data={projects,items:[...map.values()],checks,generatedAt:new Date().toISOString(),liveAttempted:!process.argv.includes('--offline')};
await fs.writeFile('site/data.json',JSON.stringify(data,null,2));
const adapter=`<script>
const nativeFetch=window.fetch.bind(window);let sharedFeed;
async function getSharedFeed(force=false){if(!sharedFeed||force){const r=await nativeFetch('./data.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Cannot load published feed');sharedFeed=await r.json()}return sharedFeed}
window.fetch=async(input,init={})=>{if(input==='/api/defaults')return Response.json((await getSharedFeed()).projects);if(input==='/api/seeds')return Response.json((await getSharedFeed()).items);if(input==='/api/scan'){let p=JSON.parse(init.body),d=await getSharedFeed(true),canonical=d.projects.find(x=>x.id===p.id);if(!canonical||canonical.query!==p.query)throw Error('This project is local to your browser. Add its configuration to projects.json on GitHub to include it in scheduled collection.');let result=d.checks.find(x=>x.project===p.id);return Response.json({items:d.items.filter(x=>x.project===p.id),checks:result?.checks||[{source:'Published starting leads; live collection has not run yet',ok:true,count:d.items.filter(x=>x.project===p.id).length}],checkedAt:result?.checkedAt||d.generatedAt})}return nativeFetch(input,init)};
</script>`;
let page=html.replace('<script>',adapter+'<script>').replace('↻ Check for developments','↻ Load latest shared feed').replace('No background schedule is active.','GitHub Actions is configured for daily checks at 07:17 Singapore time. Runs can be delayed or disabled by GitHub; inspect Actions for the actual last successful scan.').replace('Ready to scan. Checks cover the past six months; existing records remain in your workspace.','Load the latest shared feed to import published developments. Scheduled projects are configured in projects.json on GitHub. Browser notes and saves remain private to this device.').replace('Project reference URLs, one per line','Project reference URLs, one per line (browser settings only)').replace('Discovery query (English or local-language keywords)','Discovery query (browser copy; edit projects.json on GitHub for scheduled scans)').replace('Run your first check to collect live publication and project leads.','Load the shared feed to see collected developments.');
await fs.writeFile('site/index.html',page);await fs.writeFile('site/.nojekyll','');
console.log(JSON.stringify({projects:projects.length,items:data.items.length,checks}));
