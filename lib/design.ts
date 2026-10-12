import { z } from "zod";
export const kinds = ["resistor", "capacitor", "led", "diode", "connector", "chip"] as const;
const coordinate = z.number().finite().min(-100).max(100);
export const componentSchema = z.object({
 id:z.string().regex(/^[A-Z][A-Z0-9]{0,9}$/),kind:z.enum(kinds),value:z.string().max(80),
 footprint:z.enum(["0603","0805","1206","soic8","soic14","soic16","dip8","dip14","dip16","pinrow2","pinrow3","pinrow4","pinrow6","pinrow8"]),
 x:coordinate,y:coordinate,rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),schX:coordinate,schY:coordinate,
 pins:z.array(z.string().regex(/^[A-Za-z0-9_+\-]{1,16}$/)).min(2).max(16),
}).strict();
export const designSchema=z.object({
 version:z.literal(1),id:z.string().min(1).max(100),name:z.string().min(1).max(80),description:z.string().max(1500),voltage:z.number().finite().min(0.1).max(48),
 width:z.number().finite().min(15).max(200),height:z.number().finite().min(15).max(200),components:z.array(componentSchema).max(48),
 connections:z.array(z.object({from:z.string().max(30),to:z.string().max(30)}).strict()).max(160),notes:z.array(z.string().max(500)).max(20),
}).strict();
export type Design=z.infer<typeof designSchema>;
export type Component=z.infer<typeof componentSchema>;
export type Issue={level:"error"|"warning"|"info";message:string;part?:string};
export const makeId=()=>globalThis.crypto?.randomUUID?.()??`project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const endpoint=(c:Component,i:number)=>`${c.id}.pin${i+1}`;
export function parseValue(value:string):number{
 const m=value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([pnuµmkKMGT]?)(?:ohm|ohms|Ω|f|F)?$/);
 if(!m)return NaN;
 const factors:Record<string,number>={"":1,p:1e-12,n:1e-9,u:1e-6,"µ":1e-6,m:1e-3,k:1e3,K:1e3,M:1e6,G:1e9,T:1e12};return Number(m[1])*factors[m[2]];
}
export function checkDesign(d:Design):Issue[]{
 const issues:Issue[]=[],ids=new Set<string>(),pins=new Set<string>();
 for(const c of d.components){
  if(ids.has(c.id))issues.push({level:"error",message:`${c.id} is used more than once.`,part:c.id});ids.add(c.id);c.pins.forEach((_,i)=>pins.add(endpoint(c,i)));
  if((c.kind==="resistor"||c.kind==="capacitor")&&!(parseValue(c.value)>0))issues.push({level:"error",message:`${c.id}: enter a positive value such as 10k or 100nF.`,part:c.id});
  if(["resistor","capacitor","led","diode"].includes(c.kind)&&(!/^(0603|0805|1206)$/.test(c.footprint)||c.pins.length!==2))issues.push({level:"error",message:`${c.id}: passive components need two pins and a supported SMD footprint.`,part:c.id});
  if(c.kind==="connector"&&c.footprint!==`pinrow${c.pins.length}`)issues.push({level:"error",message:`${c.id}: connector footprint and pin count do not match.`,part:c.id});
  if(c.kind==="chip"&&!new RegExp(`^(soic|dip)${c.pins.length}$`).test(c.footprint))issues.push({level:"error",message:`${c.id}: chip footprint and pin count do not match.`,part:c.id});
  if(new Set(c.pins).size!==c.pins.length)issues.push({level:"error",message:`${c.id}: pin labels must be unique. Use GND1 / GND2 for repeated functions.`,part:c.id});
  const margin=c.kind==="connector"||c.kind==="chip"?5:2;
  if(Math.abs(c.x)+margin>d.width/2||Math.abs(c.y)+margin>d.height/2)issues.push({level:"error",message:`${c.id} is too close to or outside the board edge.`,part:c.id});
 }
 const connected=new Set<string>(),edges=new Set<string>();
 for(const t of d.connections){
  if(!pins.has(t.from)||!pins.has(t.to))issues.push({level:"error",message:`Connection ${t.from} → ${t.to} references a missing pin.`});
  if(t.from===t.to)issues.push({level:"error",message:`A pin cannot connect to itself (${t.from}).`});
  const key=[t.from,t.to].sort().join("|");if(edges.has(key))issues.push({level:"error",message:`Duplicate connection: ${t.from} ↔ ${t.to}.`});edges.add(key);connected.add(t.from);connected.add(t.to);
 }
 for(const c of d.components){const missing=c.pins.filter((_,i)=>!connected.has(endpoint(c,i)));if(missing.length)issues.push({level:"warning",message:`${c.id}: unconnected ${missing.join(", ")}.`,part:c.id});}
 if(!d.components.length)issues.push({level:"info",message:"Add a component or start with a circuit template."});
 issues.push({level:"info",message:"Checks cover structure, placement and routing. Component ratings, signal integrity, thermal behavior and real hardware operation still need engineering review."});return issues;
}
export function bomCsv(d:Design){
 const cell=(s:string)=>`"${(/^[=+@\-\t\r]/.test(s)?"'":"")+s.replaceAll('"','""')}"`;
 return [["Reference","Type","Value / description","Footprint","Quantity"],...d.components.map(c=>[c.id,c.kind,c.value,c.footprint,"1"])].map(row=>row.map(cell).join(",")).join("\r\n");
}
export function sourceCode(d:Design){
 const q=(s:string)=>`{${JSON.stringify(s)}}`;
 const lines=d.components.map(c=>{const base=`name=${q(c.id)} footprint=${q(c.footprint)} pcbX={${c.x}} pcbY={${c.y}} pcbRotation={${c.rotation}} schX={${c.schX}} schY={${c.schY}}`;
  if(c.kind==="resistor")return `      <resistor ${base} resistance={${parseValue(c.value)}} />`;
  if(c.kind==="capacitor")return `      <capacitor ${base} capacitance={${parseValue(c.value)}} />`;
  if(c.kind==="connector"||c.kind==="chip")return `      <${c.kind} ${base} pinLabels={${JSON.stringify(Object.fromEntries(c.pins.map((v,i)=>[`pin${i+1}`,[v]])))}} />`;
  return `      <${c.kind} ${base} />`;});
 return `// Generated by CopperPilot\n// Draft PCB: inspect routing and component ratings before fabrication.\nexport default function Circuit() {\n  return (\n    <board width={${d.width}} height={${d.height}} autorouter="auto-local" minTraceWidth={0.25}>\n${lines.join("\n")}\n${d.connections.map((t,i)=>`      <trace name={"T${i+1}"} from=${q(t.from)} to=${q(t.to)} thickness={0.25} />`).join("\n")}\n    </board>\n  )\n}\n`;
}
export function newComponent(kind:Component["kind"],d:Design):Component{
 const prefix={resistor:"R",capacitor:"C",led:"LED",diode:"D",connector:"J",chip:"U"}[kind];let n=1;while(d.components.some(c=>c.id===`${prefix}${n}`))n++;
 return {id:`${prefix}${n}`,kind,value:{resistor:"10k",capacitor:"100nF",led:"Red LED",diode:"Signal diode",connector:"2-pin header",chip:"Generic 8-pin IC"}[kind],footprint:kind==="connector"?"pinrow2":kind==="chip"?"soic8":"0805",x:0,y:0,rotation:0,schX:(d.components.length%4)*4-6,schY:-Math.floor(d.components.length/4)*3,pins:kind==="chip"?Array.from({length:8},(_,i)=>`P${i+1}`):kind==="led"||kind==="diode"?["A","K"]:["1","2"]};
}
