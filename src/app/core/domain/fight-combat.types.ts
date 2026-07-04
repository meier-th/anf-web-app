import {Boss} from '../../classes/boss';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';

export type Combatant =
  | { kind: 'user'; ref: User }
  | { kind: 'animal'; ref: NinjaAnimal }
  | { kind: 'boss'; ref: Boss };

export interface FightSide {
  users: User[];
  animals: NinjaAnimal[];
}

/**
 * Roster shape shared by the combat resolver and the scene renderer.
 * `mySide` is always the local player's side. `otherSide` is the opposing
 * users/animals in PVP, and is always empty in PVE (PVE's sole opponent is
 * `boss`, which is undefined in PVP).
 */
export interface FightRoster {
  type: 'pvp' | 'pve';
  mySide: FightSide;
  otherSide: FightSide;
  boss?: Boss;
  pvpCurrentUserIsBackendSecond: boolean;
}

export type FightStateEvent = {
  attacker: string;
  target: string;
  attackName: string;
  chakraCost: number;
  damage: number;
  chakraBurn: number;
  deadly: boolean;
  everyoneDead: boolean;
  nextAttacker: string;
};

export type SummonEvent = {
  summoner: string;
  name: string;
  race: string;
  maxHp: number;
  damage: number;
};

export interface ResolvedAttack {
  attacker: Combatant;
  target: Combatant;
  yourSideAttacks: boolean;
  isSurrender: boolean;
  isFightOver: boolean;
}
