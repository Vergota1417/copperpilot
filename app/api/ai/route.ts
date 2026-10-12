import { env } from "cloudflare:workers";
import { designSchema } from "@/lib/design";
import { aiAvailable,generateDesign } from "@/lib/ai";
export const dynamic="force-dynamic";
function config(){const e=env as unknown as Record<string,string|undefined>;return {key:e.OPENAI_API_KEY,baseUrl:e.AI_BASE_URL,model:e.AI_MODEL};}
export async function GET(){const c=config();return Response.json({available:aiAvailable(c),model:c.model||"gpt-4.1-mini"},{headers:{"Cache-Control":"no-store"}});}
export async function POST(request:Request){
 const origin=request.headers.get("origin");if(origin&&origin!==new URL(request.url).origin)return Response.json({error:"Invalid request origin."},{status:403});
 const e=env as unknown as Record<string,string|undefined>;
 const owner=request.headers.get("oai-authenticated-user-id");
 if(!owner&&e.COPPERPILOT_ALLOW_LOCAL_AI!=="true")return Response.json({error:"Sign in to use AI generation."},{status:401});
 if(!aiAvailable(config()))return Response.json({error:"AI is not connected yet. Starter circuits and manual editing are available."},{status:503});
 try{
  const text=await request.text();if(text.length>80000)return Response.json({error:"Request too large."},{status:413});
  const data=JSON.parse(text);if(typeof data.prompt!=="string"||data.prompt.trim().length<5||data.prompt.length>4000)return Response.json({error:"Describe your circuit in 5–4,000 characters."},{status:400});
  const parsed=designSchema.safeParse(data.design);if(!parsed.success)return Response.json({error:"The current design is invalid."},{status:400});
  const result=await generateDesign(data.prompt,parsed.data,config());return Response.json(result,{headers:{"Cache-Control":"no-store"}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Generation failed. No circuit was changed."},{status:422});}
}
