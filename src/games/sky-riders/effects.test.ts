import { FakeAudioService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { SKY_RIDERS_AUDIO_IDS, SKY_RIDERS_EFFECT_RULES, SkyRidersEffects } from "./effects.js";
import type { SkyRidersSimulationEvent } from "./simulation.js";
const O=Object.freeze({x:140,y:90});
export const tests: readonly TestCase[]=[
{name:"P12-010 gameplay effects route through shared audio service",run:()=>{const a=new FakeAudioService();const f=new SkyRidersEffects(a);const e:readonly SkyRidersSimulationEvent[]=[{type:"flap",rider:"player",position:O},{type:"combat-clash",position:O},{type:"enemy-defeated",points:100,position:O},{type:"player-hit",player:1,livesRemaining:2,position:O},{type:"storm-seed-collected",player:1,points:175,position:O},{type:"wave-cleared",wave:1,bonus:400}];f.handle(e);assert(a.playedEffects.join(",")===[SKY_RIDERS_AUDIO_IDS.flap,SKY_RIDERS_AUDIO_IDS.clash,SKY_RIDERS_AUDIO_IDS.defeat,SKY_RIDERS_AUDIO_IDS.hit,SKY_RIDERS_AUDIO_IDS.recovery,SKY_RIDERS_AUDIO_IDS.waveClear].join(","),"effects must use shared audio ids");}},
{name:"P12-010 transient visual effects are hard bounded and destroy is idempotent",run:()=>{const f=new SkyRidersEffects(new FakeAudioService());for(let i=0;i<30;i+=1)f.handle([{type:"enemy-defeated",points:100,position:O}]);assert(f.particleCount===SKY_RIDERS_EFFECT_RULES.maxParticles,"particles must cap");f.update(2);assert(Number(f.particleCount)===0,"particles expire");f.destroy();f.destroy();assert(Number(f.particleCount)===0,"destroy idempotent");}},
];
