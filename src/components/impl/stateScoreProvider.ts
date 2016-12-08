import {scoreManager} from "../score/scoreSingleton";
import CreepState from "../state/creepState";
import GlobalState from "../state/globalState";
import MineralState from "../state/mineralState";
import RoomState from "../state/roomState";
import SourceState from "../state/sourceState";
import SpawnState from "../state/spawnState";
import ScoreManager from "../score/scoreManager";
import ScoreHandler from "../score/scoreHandler";
import {log} from "../support/log";
import * as F from "../functions";
import {SCORE_KEY} from "../score/scoreManager";
import EnemyCreepState from "../state/enemyCreepState";
import {TERRAIN_PLAIN, TERRAIN_ROAD, TERRAIN_SWAMP} from "../constants";

type StateScoreImpl<T> = { [key: string]: ScoreHandler<T, GlobalState> };

// TODO distance weight in genome
// TODO distance weight relates to creep movement capability
export const DISTANCE_WEIGHT = 9;
export const FATIGUE_WEIGHT = 4;
export const WORK_WEIGHT = 2;
export const ROAD_WEIGHT = 3; // cost to maintain roads
export const SWAMP_WEIGHT = 1; // cost to route around swamps
export const COMBAT_DANGER = 10; // TODO implement risk

export default function registerStateScoreProvider() {
  scoreManager.addHandler(new CreepState("proto").className(), impl.creepState);
  scoreManager.addHandler(new EnemyCreepState("proto").className(), impl.enemyCreep);
  scoreManager.addHandler(new GlobalState("proto").className(), impl.globalState);
  scoreManager.addHandler(new MineralState("proto").className(), impl.mineralState);
  scoreManager.addHandler(new RoomState("proto").className(), impl.roomState);
  scoreManager.addHandler(new SourceState("proto").className(), impl.sourceState);
  scoreManager.addHandler(new SpawnState("proto").className(), impl.spawnState);
}

function scoreMove(state: CreepState, score: ScoreManager<GlobalState>, time: number): number {
  score = score;
  time = time;

  // TODO get context from room and score move accordingly
  return FATIGUE_WEIGHT / state.moveFatigue(2);
}

function scoreWork(state: CreepState): number {

  const creep = state.subject();
  if (creep === undefined) {
    return 0;
  }

  return WORK_WEIGHT * _.sum(creep.body, (s: BodyPartDefinition) => s.type === WORK ? 1 : 0);
}

function scoreTtl(state: CreepState): number {

  const creep = state.subject();
  if (creep === undefined) {
    return 1;
  }

  return creep.ticksToLive;
}

function scoreRoad(state: CreepState): number {

  const creep = state.subject();
  if (creep === undefined) {
    return 0;
  }

  // TODO score
  if (state.isCarrying()) {
    return (ROAD_WEIGHT * state.maxMovePenalty(TERRAIN_PLAIN) - state.maxMovePenalty(TERRAIN_ROAD)) / state.getWeight();
  }
  return (ROAD_WEIGHT * state.minMoveFatigue(TERRAIN_PLAIN) - state.minMoveFatigue(TERRAIN_ROAD)) / state.getWeight();
}

function scoreSwamp(state: CreepState): number {

  const creep = state.subject();
  if (creep === undefined) {
    return 0;
  }

  if (state.isCarrying()) {
    return SWAMP_WEIGHT * state.maxMovePenalty(TERRAIN_SWAMP) - state.maxMovePenalty(TERRAIN_PLAIN);
  }
  return SWAMP_WEIGHT * state.minMoveFatigue(TERRAIN_SWAMP) - state.minMoveFatigue(TERRAIN_PLAIN);
}

const impl = {
  // CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS CREEPS
  creepState: {
    move: scoreMove,
    venergy: scoreWork,
    ttl: scoreTtl,
    road: scoreRoad, // this goes very low if the creep gets no benefit from roads and has large part count
    swamp: scoreSwamp, // this goes very low when the creep gains large fatigue from swamps
  } as StateScoreImpl<CreepState>,

  // ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY ENEMY
  enemyCreep: {
    move: scoreMove,
  } as StateScoreImpl<EnemyCreepState>,

  // GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL GLOBAL
  globalState: {
    // TODO intellij enhancement? ((state, score, time) => {
    control: ((state: GlobalState, score: ScoreManager<GlobalState>, time: number) => {
      // sum of control for all rooms
      return _.sum(state.subject().rooms, room => {
        return F.lockAnd(RoomState.right(room),
          s => score.getOrRescore(s, s.memory(SCORE_KEY), "control", time));
      });
    }) as ScoreHandler<GlobalState, GlobalState>,
    energy: ((state: GlobalState, score: ScoreManager<GlobalState>, time: number) => {
      // log.debug("scoring global energy");
      return _(state.eachSource(source => {
        let rval = 0;
        // TODO source access bonus
        // energy velocity for each source
        rval += score.getOrRescore(source, source.memory(SCORE_KEY), "venergy", time);
        // energy transport score for each source
        rval += score.getOrRescore(source, source.memory(SCORE_KEY), "tenergy", time);
        // military risk is folded into the SourceState's raw score
        // also the score delta between global.energy and sum of sources? TODO consider
        return rval;
      })).sum();
    }) as ScoreHandler<GlobalState, GlobalState>,
    military: ((state: GlobalState, score: ScoreManager<GlobalState>, time: number) => {
      state = state;
      score = score;
      time = time;

      return 0;
    }) as ScoreHandler<GlobalState, GlobalState>,
    minerals: ((state: GlobalState, score: ScoreManager<GlobalState>, time: number) => {
      return _.sum(state.minerals(), source => {
        let rval = 0;
        // TODO weights per mineral type
        // TODO mineral access bonus
        // mineral velocity for each mine
        rval += score.getOrRescore(source, source.memory(SCORE_KEY), "vminerals", time);
        // mineral transport score for each mine
        rval += score.getOrRescore(source, source.memory(SCORE_KEY), "tminerals", time);
        // military risk is folded into the MineralState's raw score
        // also the score delta between global.energy and sum of sources? TODO consider
        return rval;
      });
    }) as ScoreHandler<GlobalState, GlobalState>,
  } as StateScoreImpl<GlobalState>,

  // MINERALS MINERALS MINERALS MINERALS MINERALS MINERALS MINERALS MINERALS MINERALS MINERALS MINERALS MINERALS
  mineralState: {
    tminerals: ((state: MineralState) => {
      state = state;
      // tenergy - distance to an energy transport building
      return 0;
    }) as ScoreHandler<MineralState, GlobalState>,
    vminerals: ((state: MineralState) => {
      return state.nodeDirs().length; // number of work sites
      // TODO vminerals is limited to minerals regen rate
    }) as ScoreHandler<MineralState, GlobalState>,
  } as StateScoreImpl<MineralState>,

  // ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS ROOMS
  roomState: {
    control: ((state: RoomState) => {
      if (state.resolve()) {
        const c = state.subject().controller;
        return c && c.my ? c.level : 0;
      }
      return 0;
    }) as ScoreHandler<RoomState, GlobalState>,
    venergy: ((state: RoomState, score: ScoreManager<GlobalState>, time: number) => {
      return _(state.eachSource(source => {
        return score.getOrRescore(source, source.memory(SCORE_KEY), "venergy", time);
      })).sum();
    }) as ScoreHandler<RoomState, GlobalState>,
    vminerals: ((state: RoomState, score: ScoreManager<GlobalState>, time: number) => {
      return _(state.eachMineral(minerals => {
        return score.getOrRescore(minerals, minerals.memory(SCORE_KEY), "venergy", time);
      })).sum();
    }) as ScoreHandler<RoomState, GlobalState>,
  } as StateScoreImpl<RoomState>,

  // SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES SOURCES
  sourceState: {
    tenergy: ((state: SourceState) => {
      const pos = state.pos();
      const ownRoom = RoomState.vleft(pos.roomName);

      let distanceScore = Infinity;

      // tenergy - distance to an energy transport building
      // TODO 1 - score distance to adjacent rooms (& store paths)
      // TODO 2 - score distance on paths & from exits to all storage in that room

      // 3 - score distance to closest energy user in same room
      if (ownRoom.resolve()) {
        const realRoom = ownRoom.subject();

        const roomSiteScore = _(
            realRoom.find(FIND_CONSTRUCTION_SITES, {filter: F.wantsEnergy}))
          .concat(
            realRoom.find(FIND_MY_STRUCTURES, {filter: F.wantsEnergy}))
          .sortBy(F.byRangeTo(pos))
          .map(F.byRangeScore(pos))
          .first();

        distanceScore = Math.min(distanceScore, roomSiteScore);
      } else {
        log.warning("did not resolve", ownRoom);
      }

      return DISTANCE_WEIGHT / distanceScore; // TODO distance weight
    }) as ScoreHandler<SourceState, GlobalState>,
    venergy: ((state: SourceState) => {
      // venergy - number of potential workers
      return state.nodeDirs().length;
      // TODO venergy is limited to source regen rate
    }) as ScoreHandler<SourceState, GlobalState>,
  } as StateScoreImpl<SourceState>,

  // SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS SPAWNS
  spawnState: {
    control: ((state: SpawnState) => {
      state = state; // TODO does control of a room influence spawn's capabilities?
      return 0;
    }) as ScoreHandler<SpawnState, GlobalState>,
    energy: ((state: SpawnState) => {
      return state.subject().room.energyAvailable;
    }) as ScoreHandler<SpawnState, GlobalState>,
  } as StateScoreImpl<SpawnState>,
};