import { writeFileSync } from 'node:fs';
import { interpretConversation } from '../lib/ai/interpretConversation.ts';
import { createClient } from '@supabase/supabase-js';
import { enrichCommercialCatalogue } from '../lib/stylist/commerceCatalogue.ts';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
async function getCatalogueProducts(){const rows=[];for(let offset=0;;offset+=200){const {data,error}=await db.from('product_catalog').select('*').order('product_id').range(offset,offset+199);if(error)throw new Error(error.code);rows.push(...data);if(data.length<200)break;}return enrichCommercialCatalogue(rows);}
import { loadPreferenceValues } from '../lib/catalogue/preferenceValues.ts';
import { newSession, makeTurn, acceptReply, snapshot } from '../lib/stylist/conversationProtocol.ts';
import { interpreterInput, shortcutPlan, finishConversationTurn } from '../lib/stylist/conversationTurn.ts';
import { checkConversationPlan } from '../lib/stylist/conversationPlan.ts';
const phase=['after','precise'].includes(process.argv[2])?process.argv[2]:'before';
process.env.STYLIST_DIAGNOSTICS_ENABLED='true';
const [catalogue, vocabulary] = await Promise.all([getCatalogueProducts(), loadPreferenceValues()]);
const output = { configured_model: process.env.OPENAI_CONVERSATION_MODEL || 'gpt-5.6-luna', features: {commerce:process.env.STYLIST_COMMERCE_ENABLED !== 'false'}, catalogue_count:catalogue.length, vocabulary:Object.fromEntries(['subcategory','product_type','fit','occasion'].map(k=>[k,[...new Set(vocabulary.rows.map(r=>r[k]).filter(Boolean))]])), cases:[] };
const cases = [
 {name:'precise',messages:["I know exactly what I want: women's black high-waisted wide-leg trousers, full length not cropped, AU 12. No polyester, no elasticated waist, under $140 AUD. It's for work, not a party. What actually matches?"]},
 {name:'event',messages:["Help! I've got a friend's wedding at a winery and the invite says cocktail. I basically live in jeans. Around $280 for a dress AND shoes, not $280 each. Where do I start?", "I don't mean a particular product — you haven't shown me one. Please find a wedding guest dress and shoes for $280 total, excluding white. Women's collection."]},
 {name:'jackets',messages:["Show jackets under $120, both men's and women's. No beige or yellow."]},
 {name:'shirt',messages:["I'm buying my dad a men's work shirt. Medium, regular fit, under $100. Show me options."]},
 {name:'saved-dress',messages:["Show flat shoes under $125 to go with my saved Olive Maxi Dress. Keep the dress."],seed(s){const p=catalogue.find(r=>r.product_id==='P1189');s.context.latest=[snapshot(p)];s.styling.outfit=[{...snapshot(p),ownership:'selected'}];s.scopes.item={...s.scopes.item,category:'Clothing',subcategory:'Dresses',gender:'Women',occasion:'Wedding Guest',max_price:180};s.collection.choice='Women';}},
];
for (const c of cases.filter(c=>phase==='precise'?c.name==='precise':c.name!=='precise')) {
 let session=newSession(); c.seed?.(session);
 for (const message of c.messages) {
  const started=Date.now();const turn=makeTurn(session,message);const input=interpreterInput(turn);
  const plan=shortcutPlan(turn) ?? await interpretConversation(input);
  const checked=checkConversationPlan(input,plan);
  const reply=finishConversationTurn(catalogue,turn,plan,vocabulary);
  output.cases.push({name:c.name,input,plan,checked,reply,duration_ms:Date.now()-started});
  session=acceptReply(turn,reply).session;
  console.log(JSON.stringify({case:c.name,action:plan.action,status:reply.status,message:reply.message,preferences:reply.applied_preferences,shared:reply.proposed_scopes.shared}));
  writeFileSync(new URL(`../docs/reports/stylist-remediation-2026-10-19/diagnosis-${phase}.json`,import.meta.url),JSON.stringify(output,null,2)+'\n');
 }
}
