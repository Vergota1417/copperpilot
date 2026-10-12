import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("..",import.meta.url));
function run(command,args,check=true){const r=spawnSync(command,args,{cwd:root,stdio:"inherit"});if(r.error)throw r.error;if(check&&r.status!==0)throw new Error(`${command} failed. No further changes were made.`);return r.status;}
run("gh",["auth","status"]);
if(!existsSync(new URL("../.git",import.meta.url)))run("git",["init","-b","main"]);
const existing=spawnSync("git",["remote","get-url","github"],{cwd:root,stdio:"ignore"});
if(existing.status===0)throw new Error("A github remote already exists. Inspect it before publishing again.");
run("git",["add","."]);
const staged=spawnSync("git",["diff","--cached","--quiet"],{cwd:root,stdio:"ignore"});
if(staged.status===1)run("git",["commit","-m","Build CopperPilot circuit workbench"]);
else if(staged.status!==0)throw new Error("Could not inspect the Git index.");
run("gh",["repo","create","copperpilot","--private","--source",".","--remote","github","--push","--description","Open-source circuit workbench with tscircuit, PCB routing and AI-assisted design."]);
