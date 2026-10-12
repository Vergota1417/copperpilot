import { createElement } from "react";
import { Circuit } from "@tscircuit/core";
import { convertCircuitJsonToPcbSvg,convertCircuitJsonToSchematicSvg } from "circuit-to-svg";
import { convertCircuitJsonToGerberFiles } from "circuit-json-to-gerber";
import { checkDesign,designSchema,parseValue,type Design,type Issue } from "./design";

export async function compileDesign(input:Design){
 const design=designSchema.parse(input);const errors=checkDesign(design).filter(i=>i.level==="error");if(errors.length)throw new Error(errors.map(i=>i.message).join(" "));
 const circuit=new Circuit();
 const parts=design.components.map(c=>{
  const props:Record<string,unknown>={name:c.id,footprint:c.footprint,pcbX:c.x,pcbY:c.y,pcbRotation:c.rotation,schX:c.schX,schY:c.schY};
  let kind:string=c.kind;
  if(kind==="resistor")props.resistance=parseValue(c.value);
  if(kind==="capacitor")props.capacitance=parseValue(c.value);
  if(kind==="connector"||kind==="chip"){props.pinLabels=Object.fromEntries(c.pins.map((p,i)=>[`pin${i+1}`,[p]]));}
  return createElement(kind,props);
 });
 const traces=design.connections.map((t,i)=>createElement("trace",{name:`T${i+1}`,from:t.from,to:t.to,thickness:0.25}));
 circuit.add(createElement("board",{width:design.width,height:design.height,autorouter:"auto-local",minTraceWidth:0.25},...parts,...traces));
 await circuit.renderUntilSettled();
 const json=circuit.getCircuitJson();
 const issues:Issue[]=json.filter(e=>e.type.includes("error")||e.type.includes("warning")).map(e=>({level:e.type.includes("error")?"error":"warning",message:String((e as unknown as Record<string,unknown>).message||e.type)}));
 const traceCount=json.filter(e=>e.type==="pcb_trace").length;
 if(design.connections.length>0&&traceCount===0)issues.push({level:"error",message:"No PCB traces were routed. Fabrication export is blocked."});
 let gerbers:Record<string,string>={};
 if(!issues.some(i=>i.level==="error")&&traceCount>0){try{gerbers=convertCircuitJsonToGerberFiles(json);}catch{issues.push({level:"error",message:"Gerber conversion failed. Source and schematic exports remain available."});}}
 return {
  json:json as unknown as Record<string,unknown>[],issues,traceCount,gerbers,
  schematicSvg:convertCircuitJsonToSchematicSvg(json,{width:1000,height:650,includeVersion:false,colorOverrides:{schematic:{background:"transparent",component_body:"#f6f0df",component_outline:"#6b7859",wire:"#8a9d78",pin:"#889974",pin_name:"#7a886b",pin_number:"#acb39e",reference:"#637350",value:"#939d85"}}}),
  pcbSvg:convertCircuitJsonToPcbSvg(json,{width:1000,height:650,includeVersion:false,backgroundColor:"transparent",showSolderMask:false,showPinNumbers:true,shouldDrawRatsNest:issues.some(i=>i.level==="error"),shouldDrawErrors:true,colorOverrides:{copper:{top:"#d7b388",bottom:"#71a993"},substrate:"#153d2c",boardOutline:"#90a58c",drill:"#1e2e26",silkscreen:{top:"#d9dfc0",bottom:"#8ca694"}}}),
 };
}
