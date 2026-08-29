import { assert, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_SCORING } from "./design.js";
import { createJungleQuestPlayer, type JungleQuestPlayerState } from "./player.js";
import { JungleQuestSimulation } from "./simulation.js";
import { jungleQuestCollectibleIds } from "./world.js";
const N=Object.freeze({horizontal:0 as const,vertical:0 as const,jumpPressed:false,vinePressed:false});
function player(x:number,y:number):JungleQuestPlayerState{return createJungleQuestPlayer({x,y});}
export const tests: readonly TestCase[]=[
 {name:"P13-006 contact hazard costs one life and respawns with protection",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(220,182),initialScore:300});const events=s.update(N,0);assert(s.lives===2&&s.score===200,"hazard must cost one life and penalty");assert(events.some((e)=>e.type==="player-hit"),"hit must emit event");assert(s.roomId==="fern-gate"&&s.player.position.x===24&&s.invulnerabilitySeconds>0,"survivor must respawn at checkpoint with protection");s.update(N,.01);assert(Number(s.lives)===2,"protection must prevent immediate repeat contact loss");}},
 {name:"P13-006 pit fall costs a life and returns to checkpoint",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(275,260)});const events=s.update(N,0);assert(s.lives===2&&events.some((e)=>e.type==="player-hit"),"falling below room must cost one life");assert(s.player.position.x===24&&s.player.position.y===182,"pit must respawn at checkpoint");}},
 {name:"P13-006 pit recovery is immediate even during contact protection",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(275,260),initialInvulnerabilitySeconds:1});s.update(N,0);assert(s.lives===2&&s.player.position.y===182,"pit must bypass contact-only invulnerability");}},
 {name:"P13-007 room transition advances checkpoint and awards once",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialRoomId:"echo-hollow",initialPlayer:player(326,182)});const events=s.update(N,0);assert(s.roomId==="root-vault","right boundary must enter Root Vault");assert(s.score===JUNGLE_QUEST_SCORING.checkpoint&&events.some((e)=>e.type==="checkpoint"),"new checkpoint must score once");}},
 {name:"CR-001 held rightward input actually reaches the room transition",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(310,182)});const HOLD_RIGHT=Object.freeze({horizontal:1 as const,vertical:0 as const,jumpPressed:false,vinePressed:false});let transitioned=false;for(let i=0;i<180&&!transitioned;i+=1){s.update(HOLD_RIGHT,1/60);if(s.roomId==="echo-hollow")transitioned=true;}assert(transitioned,"holding right from the near edge must eventually cross into the next room, not stick at the on-screen bound forever");assert(s.player.position.x<20,"player must land near the left edge of the new room after transitioning");}},
 {name:"CR-001 a dead-end room boundary still clamps the player on-screen",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialRoomId:"sun-shrine",initialPlayer:player(310,182)});const HOLD_RIGHT=Object.freeze({horizontal:1 as const,vertical:0 as const,jumpPressed:false,vinePressed:false});for(let i=0;i<180;i+=1)s.update(HOLD_RIGHT,1/60);assert(s.roomId==="sun-shrine","the finish room has no next room to transition into");assert(s.player.position.x<=315,"player must stay clamped on-screen at a dead-end boundary");}},
 {name:"P13-008 relic collection is unique and scores once",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(92,132)});s.update(N,0);assert(s.hasCollected("jade-seed")&&s.score===JUNGLE_QUEST_SCORING.relic,"touching relic must collect and score");s.update(N,0);assert(s.collectedCount===1&&Number(s.score)===JUNGLE_QUEST_SCORING.relic,"collected relic must not score twice");}},
 {name:"P13-008 complete relic set at shrine produces terminal score",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialRoomId:"sun-shrine",initialPlayer:player(301,182),collectedIds:jungleQuestCollectibleIds(),initialScore:1000});const events=s.update(N,0);assert(s.ended&&s.endReason==="completed"&&s.score>1000,"finish with all relics must complete and award bonus");assert(events.filter((e)=>e.type==="run-ended").length===1,"completion must emit one terminal event");assert(s.update(N,1).length===0,"ended run must stop gameplay events");}},
 {name:"P13-008 timer expiration terminates run without bonus",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialElapsedSeconds:164.99,initialScore:450});const events=s.update(N,.02);assert(s.ended&&s.endReason==="time-expired"&&s.score===450,"expired timer must preserve score and end run");assert(events.some((e)=>e.type==="run-ended"&&e.reason==="time-expired"),"timer must emit terminal event");}},
 {name:"P13-006 final life loss is terminal",run:()=>{const s=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(220,182),initialLives:1});const events=s.update(N,0);assert(s.ended&&s.endReason==="out-of-lives"&&s.lives===0,"last hazard hit must end run");assert(events.some((e)=>e.type==="run-ended"&&e.reason==="out-of-lives"),"last life must emit terminal event");}},
 {name:"CR-024 walking back to an earlier checkpoint room re-awards nothing and does not move the respawn back",run:()=>{
  // fern-gate and root-vault are the two rooms carrying a checkpoint, with echo-hollow (no
  // checkpoint) between them, and every link is bidirectional -- so backward re-entry is reachable
  // by real input, not ruled out by level geometry. Drive forward to root-vault's checkpoint, then
  // walk all the way back to fern-gate.
  const HOLD_RIGHT=Object.freeze({horizontal:1 as const,vertical:0 as const,jumpPressed:false,vinePressed:false});
  const HOLD_LEFT=Object.freeze({horizontal:-1 as const,vertical:0 as const,jumpPressed:false,vinePressed:false});
  const s=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(310,182)});
  const roomOf=(run:JungleQuestSimulation):string=>run.roomId;
  for(let i=0;i<600&&roomOf(s)!=="root-vault";i+=1)s.update(HOLD_RIGHT,1/60);
  assert(roomOf(s)==="root-vault","fixture premise: the player must reach the second checkpoint room by real input");
  const scoreAtSecondCheckpoint=s.score;
  assert(scoreAtSecondCheckpoint>=JUNGLE_QUEST_SCORING.checkpoint,"reaching root-vault must have awarded its checkpoint");

  let backwardCheckpoints=0;
  for(let i=0;i<900&&roomOf(s)!=="fern-gate";i+=1){
    const events=s.update(HOLD_LEFT,1/60);
    backwardCheckpoints+=events.filter((e)=>e.type==="checkpoint").length;
  }
  assert(roomOf(s)==="fern-gate","fixture premise: the player must be able to walk back to the first checkpoint room");
  assert(backwardCheckpoints===0,"re-entering an already-banked checkpoint room must not award its bonus again");
  assert(Number(s.score)===scoreAtSecondCheckpoint,"backward travel must not add score for a checkpoint already banked");

  // The respawn point is only observable through where a death puts the player, so kill the run
  // back to it: the pit below the room floor costs a life and returns the player to the checkpoint.
  const dying=new JungleQuestSimulation({difficulty:"expedition",initialPlayer:player(275,260)});
  assert(dying.update(N,0).some((e)=>e.type==="player-hit"),"fixture premise: falling below the floor must cost a life");
  const fernRespawn=dying.player.position.x;
  for(let i=0;i<600&&s.player.position.y<260;i+=1)s.update({...HOLD_LEFT,horizontal:0 as const},1/60);
  assert(roomOf(s)==="root-vault","a banked checkpoint must still respawn the player in root-vault, not back in fern-gate");
  assert(s.player.position.x!==fernRespawn,"the respawn point must not regress to the earlier room's checkpoint");
 }},
 {name:"CR-001 all four rooms are reachable by chained transitions from the checkpoint spawn",run:()=>{
  // CR-001's acceptance asks for the whole chain driven from a normal start, so this run injects
  // no player position at all -- it begins where a real run begins, at the Fern Gate checkpoint,
  // and holds right for the entire route. The two scripted jumps are the two obstacles Fern Gate
  // puts between the checkpoint and its right edge (the contact hazard at 214-238, then the pit
  // between the left and right ground platforms at 258-296); every later room is crossed by the
  // held run alone, Echo Hollow via the lower tunnel it drops into.
  const s=new JungleQuestSimulation({difficulty:"expedition"});
  const roomOf=(run:JungleQuestSimulation):string=>run.roomId;
  const order:string[]=[roomOf(s)];
  let firedInRoom=new Set<number>();
  for(let i=0;i<2000&&order[order.length-1]!=="sun-shrine";i+=1){
    const grounded=s.player.mode==="ground";
    const x=s.player.position.x;
    const trigger=roomOf(s)==="fern-gate"?[200,250].find((v)=>x>=v&&x<v+3):undefined;
    const jump=grounded&&trigger!==undefined&&!firedInRoom.has(trigger);
    if(jump)firedInRoom.add(trigger);
    const before=roomOf(s);
    s.update({horizontal:1,vertical:0,jumpPressed:jump,vinePressed:false},1/60);
    if(roomOf(s)!==before){order.push(roomOf(s));firedInRoom=new Set<number>();}
  }
  assert(order.join(">")==="fern-gate>echo-hollow>root-vault>sun-shrine",`held input must chain through every room in order, got ${order.join(">")}`);
  assert(Number(s.lives)===3,"the route must be completable without dying, so the chain is real traversal and not respawn teleporting");
 }},
];
