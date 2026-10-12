import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { designSchema,checkDesign,parseValue,bomCsv,sourceCode } from "../lib/design";
import { templates,templateDesign } from "../lib/templates";
import { compileDesign } from "../lib/engine";
import { generateDesign } from "../lib/ai";

test("engineering units retain case-sensitive SI prefixes",()=>{
 assert.equal(parseValue("4.7k"),4700);assert.ok(Math.abs(parseValue("100nF")-1e-7)<1e-20);assert.equal(parseValue("1M"),1000000);assert.equal(parseValue("1m"),.001);assert.ok(Number.isNaN(parseValue("javascript:alert(1)")));
});
test("project JSON round-trips all user data and new projects get distinct identities",()=>{
 for(const t of templates){assert.deepEqual(designSchema.parse(JSON.parse(JSON.stringify(t.design))),t.design);assert.equal(checkDesign(t.design).filter(i=>i.level==="error").length,0);}
 assert.notEqual(templateDesign("led").id,templateDesign("led").id);
});
test("invalid imports and generated designs are rejected at the data boundary",()=>{
 const d=templateDesign("led");assert.equal(designSchema.safeParse({...d,width:0}).success,false);assert.equal(designSchema.safeParse({...d,version:2}).success,false);
 assert.equal(designSchema.safeParse({...d,components:[{...d.components[0],footprint:"https://evil.invalid/part"}]}).success,false);
 assert.equal(designSchema.safeParse({...d,script:"alert(1)"}).success,false);
});
test("dangling pins, duplicate connections, and mismatched footprints are caught",()=>{
 const d=templateDesign("led");d.connections.push({from:"U99.pin7",to:"R1.pin1"},d.connections[0]);d.components[0].pins.push("extra");
 const errors=checkDesign(d).filter(i=>i.level==="error");assert.ok(errors.some(e=>e.message.includes("missing pin")));assert.ok(errors.some(e=>e.message.includes("Duplicate")));assert.ok(errors.some(e=>e.message.includes("pin count")));
});
test("CSV protects formula-looking descriptions and escapes commas and quotes",()=>{
 const d=templateDesign("led");d.components[0].value='=HYPERLINK("x","y")';const csv=bomCsv(d);assert.ok(csv.includes('"\'=HYPERLINK(""x"",""y"")"'));
});
for(const t of templates)test(`${t.title} compiles to responsive diagrams, a routed PCB, and genuine fabrication files`,{timeout:60000},async()=>{
 const r=await compileDesign(t.design);assert.equal(r.issues.filter(i=>i.level==="error").length,0,JSON.stringify(r.issues));
 assert.ok(r.traceCount>=t.design.connections.length);assert.ok(r.json.some(e=>e.type==="pcb_board"));assert.ok(r.json.some(e=>e.type==="schematic_component"));
 assert.match(r.schematicSvg,/<svg/);assert.match(r.pcbSvg,/<svg/);assert.ok(r.gerbers["F_Cu.gbr"].includes("M02"));assert.ok(r.gerbers["Edge_Cuts.gbr"]);assert.ok(Object.keys(r.gerbers).some(k=>k.endsWith(".drl")));
 for(const [name,svg] of Object.entries({schematic:r.schematicSvg,pcb:r.pcbSvg})){
  const root=svg.match(/<svg\b[^>]*>/)?.[0]??"";
  const width=Number(root.match(/\bwidth="([\d.]+)"/)?.[1]);
  const height=Number(root.match(/\bheight="([\d.]+)"/)?.[1]);
  assert.ok(width>0&&height>0,`${name} has a valid rendering size`);
  const viewBox=root.match(/\bviewBox="([^"]+)"/)?.[1].trim().split(/[\s,]+/).map(Number);
  assert.deepEqual(viewBox,[0,0,width,height],`${name} must scale its full drawing into narrow screens`);
  assert.match(root,/\bpreserveAspectRatio="xMidYMid meet"/,`${name} must fit without stretching or cropping`);
 }
});
test("AI unavailable does not silently turn into a fake generated design",async()=>{
 await assert.rejects(()=>generateDesign("Make a circuit",templateDesign("led"),{}),/AI is not connected/);
});
test("AI model response is validated and preserves the current project identity",async()=>{
 const current=templateDesign("led");const generated=templateDesign("divider");
 const fetcher:typeof fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({design:generated,explanation:"Created a divider."})}}]}),{status:200});
 const r=await generateDesign("Make a divider",current,{key:"test-only"},fetcher);assert.equal(r.design.id,current.id);assert.equal(r.design.name,"Voltage divider");assert.equal(current.name,"3.3 V LED indicator");
});
test("invalid AI outputs and provider failures never become an applicable draft",async()=>{
 const current=templateDesign("led");
 const badFetch:typeof fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'{"design":{"version":77}}'}}]}),{status:200});
 await assert.rejects(()=>generateDesign("Make something",current,{key:"test-only"},badFetch),/supported design format/);
 const denied:typeof fetch=async()=>new Response("no",{status:401});await assert.rejects(()=>generateDesign("Make something",current,{key:"test-only"},denied),/rejected its API key/);
});
test("exported tscircuit source uses the same supported routing and connector types",()=>{
 const source=sourceCode(templateDesign("i2c"));assert.ok(source.includes('<connector'));assert.ok(source.includes('autorouter="auto-local"'));assert.ok(source.includes('minTraceWidth={0.25}'));assert.ok(source.includes('thickness={0.25}'));assert.ok(!source.includes('sequential-trace'));
});
