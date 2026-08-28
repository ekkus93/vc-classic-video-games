import type { ScoreService, ScoreSubmission } from "../../engine/index.js";
import { FakeScoreService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { JungleQuestScoreCommitter } from "./score-submission.js";
class RejectingScores implements ScoreService { public submit(_submission: ScoreSubmission): Promise<void>{return Promise.reject(new Error("injected persistence failure"));} }
const terminal=Object.freeze({type:"run-ended" as const,reason:"completed" as const,score:1234,bonus:500});
export const tests: readonly TestCase[]=[
 {name:"P13-007 score committer submits only one terminal score per run",run:async()=>{const scores=new FakeScoreService();const c=new JungleQuestScoreCommitter(scores);c.handle([{type:"jumped",position:{x:0,y:0}}]);c.handle([terminal]);c.handle([terminal]);await Promise.resolve();assert(Number(scores.submissions.length)===1&&scores.submissions[0]?.score===1234,"terminal score must submit exactly once");c.reset();c.handle([terminal]);assert(Number(scores.submissions.length)===2,"reset must enable a fresh run submission");}},
 {name:"P13-007 rejected score persistence is contained",run:async()=>{const errors:unknown[]=[];const c=new JungleQuestScoreCommitter(new RejectingScores(),(error)=>errors.push(error));c.handle([terminal]);await Promise.resolve();await Promise.resolve();assert(errors.length===1,"persistence rejection must be reported without escaping gameplay");}},
];
