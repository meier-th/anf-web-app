import {Injectable} from '@angular/core';
import {Boss} from '../../classes/boss';
import {FIGHT_CONSTANTS} from '../constants/app.constants';
import {Combatant, FightRoster, FightSide, FightStateEvent, ResolvedAttack} from './fight-combat.types';
import {FightDomainService} from './fight-domain.service';

/**
 * Interprets an incoming `/user/fightState` websocket event against the
 * current roster: who attacked, who got hit, and whose side that is.
 *
 * Pure and stateless - never mutates HP/chakra, never touches the DOM.
 * PVP and PVE share one algorithm: PVE is just a PVP roster where
 * `otherSide` is empty and `boss` stands in for the opposing side.
 */
@Injectable({
  providedIn: 'root'
})
export class FightCombatResolver {
  constructor(private fightDomain: FightDomainService) {
  }

  resolve(roster: FightRoster, event: FightStateEvent): ResolvedAttack {
    const isSurrender = (event.attackName ?? '').toLowerCase() === FIGHT_CONSTANTS.surrenderAttackName;
    const attackerFromOtherSide = this.identifyInSide(event.attacker, roster.otherSide);
    const attackerFromMySide = attackerFromOtherSide ? undefined : this.identifyInSide(event.attacker, roster.mySide);

    let attacker: Combatant;
    let yourSideAttacks: boolean;
    let target: Combatant | undefined;

    if (attackerFromOtherSide) {
      attacker = attackerFromOtherSide;
      yourSideAttacks = false;
      target = this.identifyInSide(event.target, roster.mySide);
    } else if (attackerFromMySide) {
      attacker = attackerFromMySide;
      yourSideAttacks = true;
      target = roster.boss ? {kind: 'boss', ref: roster.boss} : this.identifyInSide(event.target, roster.otherSide);
    } else {
      // Neither roster side owns this token: the sole remaining attacker is the PVE boss.
      attacker = {kind: 'boss', ref: roster.boss as Boss};
      yourSideAttacks = false;
      target = this.identifyInSide(event.target, roster.mySide);
    }

    return {
      attacker,
      target: target as Combatant,
      yourSideAttacks,
      isSurrender,
      isFightOver: !!event.everyoneDead
    };
  }

  private identifyInSide(token: string, side: FightSide): Combatant | undefined {
    const user = side.users.find((it) => it.login === token);
    if (user) {
      return {kind: 'user', ref: user};
    }
    const animal = this.fightDomain.findAnimalByToken(side.animals, token);
    if (animal) {
      return {kind: 'animal', ref: animal};
    }
    return undefined;
  }
}
