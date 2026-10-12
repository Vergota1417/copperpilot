import { compileDesign } from "./engine";
self.onmessage=async(event)=>{try{const result=await compileDesign(event.data);self.postMessage({result});}catch(e){self.postMessage({error:e instanceof Error?e.message:"Circuit compilation failed."});}};
