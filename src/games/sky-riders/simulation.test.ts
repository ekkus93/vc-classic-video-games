import { SeededRandomService } from "../../engine/testing/fake-services.js";
import { assert, type TestCase } from "../../test/harness.js";
import { SKY_RIDERS_RUN_RULES, SKY_RIDERS_SCORING, skyRidersEnemyCount } from "./design.js";
import { createSkyRider, riderOverlap } from "./physics.js";
import { SkyRidersSimulation, type SkyRidersEnemyState, type SkyRidersPlayerState, type SkyRidersStormSeed } from "./simulation.js";
function playerState(player:1|2,x:number,y:number,lives=3):SkyRidersPlayerState{return Object.freeze({player,rider:createSkyRider(player,{x,y}),lives,active:true});}
function enemyState(id:number,x:number,y:number):SkyRidersEnemyState{return Object.freeze({rider:createSkyRider(id,{x,y}),decisionSeconds:1});}
export const tests: readonly TestCase[] = [
  {name:"P12-005 fixed seed reproduces enemy generation and AI decisions",run:()=>{const a=new SkyRidersSimulation({rng:new SeededRandomService(0x512),difficulty:"squall",players:1});const b=new SkyRidersSimulation({rng:new SeededRandomService(0x512),difficulty:"squall",players:1});for(let i=0;i<90;i+=1){a.update([],1/60);b.update([],1/60);}assert(JSON.stringify(a.enemies)===JSON.stringify(b.enemies),"same seed must reproduce AI");}},
  {name:"P12-006 higher player defeats enemy and creates one bounded storm seed",run:()=>{const s=new SkyRidersSimulation({rng:new SeededRandomService(1),difficulty:"breeze",players:1,initialPlayerStates:[playerState(1,160,100)],initialEnemies:[enemyState(100,160,110)]});const e=s.update([],0);assert(s.enemies.length===0&&s.stormSeeds.length===1&&s.score===100,"higher rider must defeat enemy");assert(e.some(x=>x.type==="enemy-defeated"),"defeat event required");}},
  {name:"P12-006 lower player loses one reserve and respawns with protection",run:()=>{const s=new SkyRidersSimulation({rng:new SeededRandomService(2),difficulty:"squall",players:1,initialPlayerStates:[playerState(1,160,112)],initialEnemies:[enemyState(100,160,100)]});s.update([],0);const p=s.players[0];assert(p?.lives===2&&p.active&&(p.rider.invulnerabilitySeconds>0),"lower player must lose reserve and respawn protected");}},
  {name:"P12-006 near-equal altitude resolves as a non-scoring separating clash",run:()=>{const s=new SkyRidersSimulation({rng:new SeededRandomService(3),difficulty:"squall",players:1,initialPlayerStates:[playerState(1,160,100)],initialEnemies:[enemyState(100,160,102)]});const e=s.update([],0);assert(s.enemies.length===1&&s.players[0]?.lives===3&&s.score===0,"tie must be non-scoring");assert(e.some(x=>x.type==="combat-clash"),"clash event required");}},
  {name:"P12-007 storm seed collection awards bonus and expiry reforms enemy",run:()=>{const seed:SkyRidersStormSeed=Object.freeze({id:1,position:Object.freeze({x:160,y:100}),velocityY:0,remainingSeconds:2});const collect=new SkyRidersSimulation({rng:new SeededRandomService(4),difficulty:"breeze",players:1,initialPlayerStates:[playerState(1,160,100)],initialEnemies:[enemyState(100,30,40)],initialStormSeeds:[seed]});collect.update([],0);assert(collect.stormSeeds.length===0&&collect.score===SKY_RIDERS_SCORING.recovery,"seed must collect");const exp=Object.freeze({id:1,position:Object.freeze({x:280,y:60}),velocityY:0,remainingSeconds:0.01});const reform=new SkyRidersSimulation({rng:new SeededRandomService(5),difficulty:"breeze",players:1,initialPlayerStates:[playerState(1,40,100)],initialEnemies:[],initialStormSeeds:[exp]});const ev=reform.update([],0.02);assert(reform.enemies.length===1&&ev.some(x=>x.type==="storm-seed-reformed"),"expired seed must reform enemy");}},
  {name:"P12-007 storm seed lands when gravity reverses its vertical motion during the crossing step",run:()=>{const seed:SkyRidersStormSeed=Object.freeze({id:1,position:Object.freeze({x:50,y:150}),velocityY:-1,remainingSeconds:5});const s=new SkyRidersSimulation({rng:new SeededRandomService(8),difficulty:"breeze",players:1,initialPlayerStates:[playerState(1,250,100)],initialEnemies:[enemyState(100,280,40)],initialStormSeeds:[seed]});s.update([],0.22);const landed=s.stormSeeds[0];assert(landed!==undefined,"seed must remain");assert(landed.position.y===158&&landed.velocityY===0,"gravity-reversed crossing must land on west ledge");}},
  {name:"P12-008 empty wave awards bonus advances and clamps population",run:()=>{const s=new SkyRidersSimulation({rng:new SeededRandomService(6),difficulty:"tempest",players:1,initialEnemies:[],initialStormSeeds:[],initialWave:20});const e=s.update([],0);assert(s.wave===21&&s.enemies.length===SKY_RIDERS_RUN_RULES.maxEnemies,"wave must advance and cap");assert(skyRidersEnemyCount("tempest",100)===SKY_RIDERS_RUN_RULES.maxEnemies,"helper must cap");assert(e.some(x=>x.type==="wave-cleared"),"wave event required");}},
  {name:"P12-009 two-player cooperative run ends only after both players exhaust reserves",run:()=>{const s=new SkyRidersSimulation({rng:new SeededRandomService(7),difficulty:"squall",players:2,initialPlayerStates:[playerState(1,80,112,1),playerState(2,240,112,1)],initialEnemies:[enemyState(100,80,100),enemyState(101,240,100)]});const e=s.update([],0);assert(s.gameOver&&s.players.every(p=>!p.active&&p.lives===0),"both players must be out");assert(e.filter(x=>x.type==="game-over").length===1&&s.update([],1).length===0,"terminal event must occur once");}},
  {
    name: "CR-015/P12 opponent population stays inside the cap through defeat and reform",
    run: () => {
      // Every mutation path is supposed to conserve or shrink enemies + storm seeds; the runtime
      // assertion in update() now re-checks that after each of them, so an update that returns at
      // all is the invariant assertion. These two fixtures drive the two conserving paths while
      // the population is already sitting exactly on the cap, where an off-by-one would show.
      const cap = SKY_RIDERS_RUN_RULES.maxEnemies;

      // Defeat: one enemy directly below the player, the rest parked far away. dt=0 keeps every
      // other rider still, so resolveCombat is the only thing that runs.
      const parked = Array.from({ length: cap - 1 }, (_unused, index) => enemyState(200 + index, 40, 40));
      const defeat = new SkyRidersSimulation({ rng: new SeededRandomService(0x1501), difficulty: "tempest", players: 1, initialPlayerStates: [playerState(1, 160, 100)], initialEnemies: [enemyState(100, 160, 110), ...parked] });
      assert(defeat.enemies.length === cap, "fixture premise: the defeat run must start exactly at the cap");
      defeat.update([], 0);
      assert(defeat.enemies.length === cap - 1 && defeat.stormSeeds.length === 1, "a defeat must trade one enemy for one storm seed");
      assert(defeat.enemies.length + defeat.stormSeeds.length === cap, "a defeat must conserve the opponent population");

      // Reform: an expiring seed turns back into an enemy, which must not push past the cap.
      const expiring = Object.freeze({ id: 1, position: Object.freeze({ x: 280, y: 60 }), velocityY: 0, remainingSeconds: 0.01 });
      const reformParked = Array.from({ length: cap - 1 }, (_unused, index) => enemyState(300 + index, 280, 40));
      const reform = new SkyRidersSimulation({ rng: new SeededRandomService(0x1502), difficulty: "tempest", players: 1, initialPlayerStates: [playerState(1, 40, 100)], initialEnemies: reformParked, initialStormSeeds: [expiring] });
      assert(reform.enemies.length + reform.stormSeeds.length === cap, "fixture premise: the reform run must start exactly at the cap");
      const events = reform.update([], 0.02);
      assert(events.some((x) => x.type === "storm-seed-reformed"), "the expiring seed must reform");
      assert(reform.enemies.length === cap && reform.stormSeeds.length === 0, "a reform must trade one storm seed for one enemy");
    },
  },
  {
    name: "CR-015/P12 a stationary tie bounce clashes once and not again while separating",
    run: () => {
      // Two riders resting at a tie altitude clash and bounce apart, but they stay inside the
      // overlap threshold for roughly twenty frames while they separate. resolveCombat used to
      // re-run the bounce on every one of those frames, re-pinning both velocities and emitting a
      // fresh combat-clash each frame -- 13 clash events for one collision. A clash now needs the
      // pair to be closing, so a bounce fires once. Note that the enemy's own pursuit can turn it
      // back into the player before they finish separating; that is a real second approach and
      // clashes again on its merits, which is why this asserts "no clash while already moving
      // apart" rather than "no clash at all until separated".
      const s = new SkyRidersSimulation({ rng: new SeededRandomService(0x1503), difficulty: "squall", players: 1, initialPlayerStates: [playerState(1, 160, 100)], initialEnemies: [enemyState(100, 160, 102)] });
      const first = s.update([], 1 / 60);
      assert(first.filter((x) => x.type === "combat-clash").length === 1, "a stationary tie must clash exactly once on the collision frame");

      let clashes = 1;
      let frames = 0;
      let separated = false;
      let clashedLastFrame = true;
      while (frames < 240 && !separated) {
        const events = s.update([], 1 / 60);
        frames += 1;
        const clashed = events.some((x) => x.type === "combat-clash");
        // A bounce always leaves the pair moving apart faster than one frame of pursuit
        // acceleration can reverse, so a clash can never be followed immediately by another. That
        // is precisely what the per-frame re-bounce used to do.
        assert(!(clashed && clashedLastFrame), `a bounce must not clash again on the very next frame (frame ${frames})`);
        if (clashed) clashes += 1;
        clashedLastFrame = clashed;

        const player = s.players[0];
        const enemy = s.enemies[0];
        assert(player !== undefined && enemy !== undefined, "a tie must stay non-scoring across the separation");
        separated = !riderOverlap(player.rider, enemy.rider);
      }

      assert(separated, "a tie bounce must actually carry the riders past the overlap threshold");
      // CR2-013: pinned exactly, not as an upper bound. At this fixed seed (0x1503) the pair
      // separates in 21 frames with exactly one re-approach clash along the way, at frame 14 --
      // the enemy's own pursuit closing the gap again before the bounce has fully carried them
      // apart, which is a real second collision and clashes on its own merits (see the "no clash
      // while already moving apart" note above). A tolerance here would hide a regression that
      // added a third.
      assert(clashes === 2, `this fixed seed must produce exactly one collision clash plus one pursuit re-approach clash (got ${clashes} over ${frames} separation frames)`);
      assert(s.players[0]?.lives === 3 && s.enemies.length === 1 && s.score === 0, "a tie sequence must remain non-scoring and non-damaging");
    },
  },
];
