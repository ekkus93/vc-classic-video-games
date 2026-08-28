import { assert, type TestCase } from "../../test/harness.js";
import { SKY_RIDERS_RUN_RULES, type SkyRidersPlatform } from "./design.js";
import { createSkyRider, resolveAltitudeCombat, stepSkyRider, type SkyRidersRiderState } from "./physics.js";

const FULL_PLATFORM: readonly SkyRidersPlatform[] = Object.freeze([Object.freeze({ id: "test", x: 0, y: 100, width: 320 })]);
function riderAt(id: number, x: number, y: number): SkyRidersRiderState { return createSkyRider(id, { x, y }); }
export const tests: readonly TestCase[] = [
  { name: "P12-002 horizontal acceleration preserves momentum while gravity acts", run: () => {
    const initial = riderAt(1, 160, 40);
    const accelerated = stepSkyRider(initial, { horizontal: 1, flap: false }, 0.1, { maxHorizontalSpeed: SKY_RIDERS_RUN_RULES.playerMaxHorizontalSpeed }, []).rider;
    const drifting = stepSkyRider(accelerated, { horizontal: 0, flap: false }, 0.1, { maxHorizontalSpeed: SKY_RIDERS_RUN_RULES.playerMaxHorizontalSpeed }, []).rider;
    assert(accelerated.velocity.x > 0, "right input must create horizontal velocity");
    assert(drifting.velocity.x > 0 && drifting.velocity.x < accelerated.velocity.x, "released steering must preserve but drag momentum");
    assert(drifting.position.y > accelerated.position.y, "gravity must pull rider downward");
  }},
  { name: "P12-003 flap impulse is discrete and cadence gated", run: () => {
    const first = stepSkyRider(riderAt(1,160,120), {horizontal:0,flap:true}, 0.01, {maxHorizontalSpeed:92}, []).rider;
    const blocked = stepSkyRider(first, {horizontal:0,flap:true}, 0.05, {maxHorizontalSpeed:92}, []);
    const ready = stepSkyRider(blocked.rider, {horizontal:0,flap:true}, 0.2, {maxHorizontalSpeed:92}, []);
    assert(first.velocity.y < 0, "first flap must rise"); assert(!blocked.flapped, "cooldown must gate flap"); assert(ready.flapped, "later flap must apply");
  }},
  { name: "P12-004 descending platform crossing snaps stably without landing jitter", run: () => {
    const falling = Object.freeze({...riderAt(1,160,80),velocity:Object.freeze({x:0,y:90})});
    const landed=stepSkyRider(falling,{horizontal:0,flap:false},0.15,{maxHorizontalSpeed:92},FULL_PLATFORM);
    const next=stepSkyRider(landed.rider,{horizontal:0,flap:false},1/60,{maxHorizontalSpeed:92},FULL_PLATFORM);
    const y=100-SKY_RIDERS_RUN_RULES.riderHalfHeight;
    assert(landed.landedPlatformId === "test" && landed.rider.position.y===y && landed.rider.velocity.y===0,"crossing must snap to platform");
    assert(next.rider.position.y===y && next.rider.velocity.y===0,"landing must stay stable");
  }},
  { name: "P12-006 altitude combat uses documented four-pixel deterministic rule", run: () => {
    assert(resolveAltitudeCombat(riderAt(1,100,80),riderAt(2,100,84))==="first","four pixels higher wins");
    assert(resolveAltitudeCombat(riderAt(1,100,84),riderAt(2,100,80))==="second","lower rider loses");
    assert(resolveAltitudeCombat(riderAt(1,100,80),riderAt(2,100,83.99))==="tie","subthreshold is tie");
  }},
];
