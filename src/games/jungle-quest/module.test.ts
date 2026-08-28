import { createFakeGameServices } from "../../engine/testing/fake-services.js";
import { FakeGameRenderer } from "../../engine/testing/fake-renderer.js";
import { assert, type TestCase } from "../../test/harness.js";
import { JUNGLE_QUEST_AUDIO_IDS } from "./effects.js";
import { JUNGLE_QUEST_MODULE } from "./module.js";
const OPTIONS=Object.freeze({players:1,difficulty:"expedition",seed:0x130013});
export const tests: readonly TestCase[]=[
 {name:"P13-010 real module starts updates renders pauses resets and destroys through shared services",run:()=>{const services=createFakeGameServices(1);const game=JUNGLE_QUEST_MODULE.create(services);game.start(OPTIONS);services.input.setHeld(1,"action-1",true);game.update(1/60);assert(services.audio.playedEffects.includes(JUNGLE_QUEST_AUDIO_IDS.jump),"logical action-1 must drive jump audio through shared service");game.render(new FakeGameRenderer());game.pause();game.resume();game.reset();game.destroy();assert(!services.audio.isActive(JUNGLE_QUEST_AUDIO_IDS.vine),"destroy must leave no game-owned vine loop");}},
 {name:"P13-010 module rejects unsupported launch options and resolves owned assets",run:()=>{const services=createFakeGameServices();const game=JUNGLE_QUEST_MODULE.create(services);let playersFailed=false;try{game.start({...OPTIONS,players:2});}catch{playersFailed=true;}assert(playersFailed,"two-player start must fail");let difficultyFailed=false;try{game.start({...OPTIONS,difficulty:"unknown"});}catch{difficultyFailed=true;}assert(difficultyFailed,"unknown difficulty must fail");assert(JUNGLE_QUEST_MODULE.resolveAssetUrl?.("audio/jump.wav")?.includes("jump.wav")===true,"module must resolve declared audio");assert(JUNGLE_QUEST_MODULE.resolveAssetUrl?.("missing")===null,"unknown assets must not resolve");}},
];
