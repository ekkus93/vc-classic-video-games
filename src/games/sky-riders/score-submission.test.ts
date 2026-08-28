import type { ScoreService } from "../../engine/index.js";
import { FakeScoreService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { SkyRidersScoreCommitter } from "./score-submission.js";
async function flush():Promise<void>{await Promise.resolve();await Promise.resolve();}
export const tests: readonly TestCase[]=[
{name:"P12-008 terminal score submits exactly once in default mode",run:()=>{const s=new FakeScoreService();const c=new SkyRidersScoreCommitter(s);c.handle([{type:"wave-cleared",wave:1,bonus:400}]);assert(s.submissions.length===0,"nonterminal no submit");c.handle([{type:"game-over",score:1337}]);c.handle([{type:"game-over",score:9999}]);assert(Number(s.submissions.length)===1&&s.submissions[0]?.score===1337&&s.submissions[0]?.mode==="default","submit once");c.reset();c.handle([{type:"game-over",score:77}]);assert(Number(s.submissions.length)===2,"new run may submit");}},
{name:"P12-010 rejected score persistence is contained without duplicate retry",run:async()=>{let attempts=0;let reported:unknown=null;const failure=new Error("score store unavailable");const scores:ScoreService={submit:()=>{attempts+=1;return Promise.reject(failure);}};const c=new SkyRidersScoreCommitter(scores,e=>{reported=e;});c.handle([{type:"game-over",score:42}]);c.handle([{type:"game-over",score:43}]);await flush();assert(attempts===1&&reported===failure,"failure must be contained without retry");}},
];
