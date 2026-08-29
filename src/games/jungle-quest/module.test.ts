import type { GameRenderer } from "../../engine/index.js";
import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { assert, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_AUDIO_IDS } from "./effects.js";
import { JUNGLE_QUEST_MODULE, drawSealedPassages } from "./module.js";
import { JUNGLE_QUEST_ROOMS, JUNGLE_QUEST_SEALED_PASSAGE_DEPTH, jungleQuestRoom } from "./world.js";
const OPTIONS=Object.freeze({players:1,difficulty:"expedition",seed:0x130013});
class RectCapturingRenderer implements GameRenderer{public readonly rects:string[]=[];public readonly logicalWidth=320;public readonly logicalHeight=240;public clear():void{}public fillRect(x:number,y:number,width:number,height:number,color:string):void{this.rects.push(`${x},${y},${width},${height},${color}`);}public strokeRect():void{}public drawLine():void{}public fillCircle():void{}public strokeCircle():void{}public fillPolygon():void{}public drawText():void{}public drawSprite():void{}public save():void{}public restore():void{}public translate():void{}public rotate():void{}}
export const tests: readonly TestCase[]=[
 {name:"P13-010 real module starts updates renders pauses resets and destroys through shared services",run:()=>{const services=createFakeGameServices(1);const game=JUNGLE_QUEST_MODULE.create(services);game.start(OPTIONS);services.input.setHeld(1,"action-1",true);game.update(1/60);assert(services.audio.playedEffects.includes(JUNGLE_QUEST_AUDIO_IDS.jump),"logical action-1 must drive jump audio through shared service");game.render(new FakeGameRenderer());game.pause();game.resume();game.reset();game.destroy();assert(!services.audio.isActive(JUNGLE_QUEST_AUDIO_IDS.vine),"destroy must leave no game-owned vine loop");}},
 {name:"P13-010 module rejects unsupported launch options and resolves owned assets",run:()=>{const services=createFakeGameServices();const game=JUNGLE_QUEST_MODULE.create(services);let playersFailed=false;try{game.start({...OPTIONS,players:2});}catch{playersFailed=true;}assert(playersFailed,"two-player start must fail");let difficultyFailed=false;try{game.start({...OPTIONS,difficulty:"unknown"});}catch{difficultyFailed=true;}assert(difficultyFailed,"unknown difficulty must fail");assert(JUNGLE_QUEST_MODULE.resolveAssetUrl?.("audio/jump.wav")?.includes("jump.wav")===true,"module must resolve declared audio");assert(JUNGLE_QUEST_MODULE.resolveAssetUrl?.("missing")===null,"unknown assets must not resolve");}},
 {name:"CR-001 the renderer draws a rock face exactly where the simulation seals a passage",run:()=>{
  // Echo Hollow's tunnel is sealed at its west end (Fern Gate has no tunnel), so one earth-coloured
  // block must cover the passage there: from the top of the tunnel band down to the tunnel floor,
  // as deep as the simulation's clamp. Every other room draws nothing, because nothing is sealed.
  const echo=new RectCapturingRenderer();drawSealedPassages(echo,jungleQuestRoom("echo-hollow"));
  const tunnel=jungleQuestRoom("echo-hollow").platforms.find((p)=>p.id==="echo-tunnel");
  assert(tunnel!==undefined,"fixture premise: echo-hollow must have its tunnel");
  assert(echo.rects.length===1&&echo.rects[0]===`0,198,${JUNGLE_QUEST_SEALED_PASSAGE_DEPTH},${tunnel.y-198},${jungleQuestRoom("echo-hollow").palette.earth}`,`expected one rock face over the tunnel's west end, got ${echo.rects.join(" | ")}`);
  for(const room of JUNGLE_QUEST_ROOMS){if(room.id==="echo-hollow")continue;const other=new RectCapturingRenderer();drawSealedPassages(other,room);assert(other.rects.length===0,`${room.id} has no sealed passage and must draw no rock face`);}
 }},
];
