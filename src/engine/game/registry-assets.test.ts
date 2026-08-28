import { assert, type TestCase } from "../../test/harness.js";
import type { GameModule } from "./contracts.js";
import { defineGameMetadata } from "./metadata.js";
import { GameRegistry } from "./registry.js";
function fixture():GameModule{return{metadata:defineGameMetadata({id:"asset-test",title:"Asset Test",description:"Registry asset callback preservation fixture",version:1,players:[1],supportedInputs:["keyboard"],logicalWidth:320,logicalHeight:240,defaultDifficulty:"normal",difficulties:[{id:"normal",label:"Normal"}],controls:[],assetManifest:"assets.json"}),create:()=>({start:()=>undefined,update:()=>undefined,render:()=>undefined,pause:()=>undefined,resume:()=>undefined,reset:()=>undefined,destroy:()=>undefined}),resolveAssetUrl:(path:string)=>`bundle://${path}`};}
export const tests:readonly TestCase[]=[{name:"P7/P12 registry validation preserves bundled asset resolver",run:()=>{const registered=new GameRegistry([fixture()]).getModule("asset-test");assert(registered.resolveAssetUrl?.("assets.json")==="bundle://assets.json","registry must preserve resolver");}}];
