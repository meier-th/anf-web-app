import {Injectable} from '@angular/core';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';
import {FIGHT_CONSTANTS} from '../constants/app.constants';

@Injectable({
  providedIn: 'root'
})
export class FightDomainService {
  /**
   * Animal tokens/names are correlated across roster, DOM, and websocket
   * payloads by their first 3 characters (backend convention).
   */
  getAnimalStatsKey(tokenOrName: string): string {
    return (tokenOrName ?? '').substring(0, 3).toLowerCase();
  }

  getAnimalSideKey(tokenOrName: string, ally: boolean): string {
    return `${ally ? 'ally' : 'enemy'}:${this.getAnimalStatsKey(tokenOrName)}`;
  }

  getAnimalElementSideKey(tokenOrName: string, ally: boolean): string {
    return `${ally ? 'ally' : 'enemy'}:${tokenOrName ?? ''}`;
  }

  sideFromAnimalToken(token: string): 'ally' | 'enemy' | undefined {
    const marker = (token ?? '').length > 3 ? token.charAt(3) : '';
    if (marker === '1') {
      return 'ally';
    }
    if (marker === '0') {
      return 'enemy';
    }
    return undefined;
  }

  findAnimalByToken(list: NinjaAnimal[], tokenOrName: string): NinjaAnimal | undefined {
    const key = this.getAnimalStatsKey(tokenOrName).toLowerCase();
    return list.find((animal) => this.getAnimalStatsKey(animal.name).toLowerCase() === key);
  }

  /**
   * Backend PvP animal slots are keyed by canonical side: marker '1' =>
   * animals1, marker '0' => animals2. If the current user is backend
   * fighter2, enemy animals live in animals1, so the marker flips.
   */
  buildAnimalTargetToken(tokenOrName: string, ally: boolean, isPvp: boolean, pvpCurrentUserIsBackendSecond: boolean): string {
    if (isPvp && !ally) {
      const enemyMarker = pvpCurrentUserIsBackendSecond ? '1' : '0';
      return `${this.getAnimalStatsKey(tokenOrName)}${enemyMarker}`;
    }
    return `${this.getAnimalStatsKey(tokenOrName)}${ally ? '1' : '0'}`;
  }

  readNumber(source: any, ...keys: string[]): number | undefined {
    if (!source) {
      return undefined;
    }
    const normalize = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const parseNumeric = (value: any): number | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return undefined;
    };
    for (const key of keys) {
      const direct = parseNumeric(source[key]);
      if (direct !== undefined) {
        return direct;
      }
      const normalizedKey = normalize(key);
      for (const [entryKey, entryValue] of Object.entries(source)) {
        if (normalize(entryKey) === normalizedKey) {
          const loose = parseNumeric(entryValue);
          if (loose !== undefined) {
            return loose;
          }
        }
      }
    }
    return undefined;
  }

  findNumberDeep(
    source: any,
    matcher: (normalizedPath: string) => boolean,
    depth = 0,
    path = ''
  ): number | undefined {
    if (source == null || depth > 3) {
      return undefined;
    }
    if (typeof source === 'number' && Number.isFinite(source)) {
      const normalizedPath = path.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      return matcher(normalizedPath) ? source : undefined;
    }
    if (typeof source === 'string') {
      const parsed = Number(source);
      if (Number.isFinite(parsed)) {
        const normalizedPath = path.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return matcher(normalizedPath) ? parsed : undefined;
      }
      return undefined;
    }
    if (typeof source !== 'object') {
      return undefined;
    }
    for (const [key, value] of Object.entries(source)) {
      const nestedPath = path ? `${path}.${key}` : key;
      const nested = this.findNumberDeep(value, matcher, depth + 1, nestedPath);
      if (nested !== undefined) {
        return nested;
      }
    }
    return undefined;
  }

  toPercent(current?: number, max?: number): number | undefined {
    if (current === undefined || max === undefined || max <= 0) {
      return undefined;
    }
    return Math.max(0, Math.min(100, current / max * 100));
  }

  firstNonNegative(...values: Array<number | undefined>): number | undefined {
    for (const value of values) {
      if (value !== undefined && value >= 0) {
        return value;
      }
    }
    return undefined;
  }

  firstPositive(...values: Array<number | undefined>): number | undefined {
    for (const value of values) {
      if (value !== undefined && value > 0) {
        return value;
      }
    }
    return undefined;
  }

  userHpPercent(
    user: any,
    userMaxHp: { [login: string]: number },
    findLocalUserByLogin: (login: string | undefined) => User | undefined
  ): number | undefined {
    const login = user?.login;
    const source = user?.character ?? user?.gameCharacter ?? user;
    const current = this.firstNonNegative(
      this.readNumber(source, 'currentHP', 'currentHp', 'currentHpAmount', 'hp'),
      this.findNumberDeep(source, (path) => path.includes('current') && (path.includes('hp') || path.includes('health'))),
      this.readNumber(findLocalUserByLogin(login)?.character, 'currentHP', 'currentHp', 'hp')
    );
    const max = this.firstPositive(
      this.readNumber(source, 'maxHp', 'maxHP', 'maxHpAmount', 'maxHPAmount', 'hpAmount'),
      this.findNumberDeep(source, (path) => path.includes('max') && (path.includes('hp') || path.includes('health'))),
      userMaxHp[login],
      this.readNumber(findLocalUserByLogin(login)?.character, 'maxHp', 'maxHP', 'hpAmount')
    );
    if (login && current !== undefined) {
      const observed = userMaxHp[login];
      if (observed === undefined || current > observed) {
        userMaxHp[login] = current;
      }
    }
    const effectiveMax = this.firstPositive(max, userMaxHp[login], current);
    const percent = this.toPercent(current, effectiveMax);
    if (login && effectiveMax !== undefined && effectiveMax > 0) {
      userMaxHp[login] = effectiveMax;
    }
    return percent;
  }

  userChakraPercent(
    user: any,
    userMaxChakra: { [login: string]: number },
    findLocalUserByLogin: (login: string | undefined) => User | undefined
  ): number | undefined {
    const login = user?.login;
    const source = user?.character ?? user?.gameCharacter ?? user;
    const current = this.firstNonNegative(
      this.readNumber(source, 'currentChakra', 'currentchakra', 'currentChakraAmount', 'chakra'),
      this.findNumberDeep(source, (path) => path.includes('current') && path.includes('chakra')),
      this.readNumber(findLocalUserByLogin(login)?.character, 'currentChakra', 'currentchakra', 'chakra')
    );
    const max = this.firstPositive(
      this.readNumber(source, 'maxChakra', 'maxchakra', 'maxChakraAmount', 'chakraAmount'),
      this.findNumberDeep(source, (path) => path.includes('max') && path.includes('chakra')),
      userMaxChakra[login],
      this.readNumber(findLocalUserByLogin(login)?.character, 'maxChakra', 'maxchakra', 'chakraAmount')
    );
    if (login && current !== undefined) {
      const observed = userMaxChakra[login];
      if (observed === undefined || current > observed) {
        userMaxChakra[login] = current;
      }
    }
    const effectiveMax = this.firstPositive(max, userMaxChakra[login], current);
    const percent = this.toPercent(current, effectiveMax);
    if (login && effectiveMax !== undefined && effectiveMax > 0) {
      userMaxChakra[login] = effectiveMax;
    }
    return percent;
  }

  getSkillChakraCost(skill: string, self: User | undefined): number {
    if ((skill ?? '').toLowerCase() === FIGHT_CONSTANTS.defaultSkill.toLowerCase()) {
      return 0;
    }
    const handling = self?.character?.spellsKnown?.find((spellHandling) => spellHandling?.spellUse?.name === skill);
    if (!handling?.spellUse) {
      return Number.MAX_SAFE_INTEGER;
    }
    const baseConsumption = this.readNumber(handling.spellUse, 'baseChakraConsumption') ?? 0;
    const perLevelConsumption = this.readNumber(handling.spellUse, 'chakraConsumptionPerLevel') ?? 0;
    return Math.max(0, baseConsumption - handling.spellLevel * perLevelConsumption);
  }

  isSkillDisabled(skill: string, self: User | undefined): boolean {
    if ((skill ?? '').toLowerCase() === FIGHT_CONSTANTS.defaultSkill.toLowerCase()) {
      return false;
    }
    const currentChakra = this.readNumber(self?.character, 'currentChakra', 'currentchakra', 'chakra') ?? 0;
    return currentChakra < this.getSkillChakraCost(skill, self);
  }

  animalHpPercent(animal: any): number | undefined {
    const current = this.firstNonNegative(
      this.readNumber(animal, 'currentHP', 'currentHp', 'hp'),
      this.findNumberDeep(animal, (path) => path.includes('current') && (path.includes('hp') || path.includes('health')))
    );
    const max = this.firstPositive(
      this.readNumber(animal, 'maxHP', 'maxHp', 'hpAmount'),
      this.findNumberDeep(animal, (path) => path.includes('max') && (path.includes('hp') || path.includes('health')))
    );
    if (current !== undefined && max !== undefined && max > 0) {
      return this.toPercent(current, max);
    }
    return undefined;
  }

  applyDamageToAnimal(animal: any, damage: number): { hpPercent: number | undefined; current?: number; max?: number; next?: number } {
    const current = this.firstNonNegative(
      this.readNumber(animal, 'currentHP', 'currentHp', 'hp'),
      this.findNumberDeep(animal, (path) => path.includes('current') && (path.includes('hp') || path.includes('health')))
    );
    const max = this.firstPositive(
      this.readNumber(animal, 'maxHP', 'maxHp', 'hpAmount'),
      this.findNumberDeep(animal, (path) => path.includes('max') && (path.includes('hp') || path.includes('health')))
    );
    if (current === undefined || max === undefined || max <= 0) {
      return {hpPercent: undefined, current, max};
    }
    const next = Math.max(0, current - damage);
    animal.currentHP = next;
    animal.currentHp = next;
    return {hpPercent: this.toPercent(next, max), current, max, next};
  }
}
