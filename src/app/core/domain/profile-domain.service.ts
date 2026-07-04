import {Injectable} from '@angular/core';
import {Appearance} from '../../classes/appearance';
import {Character} from '../../classes/character';
import {Stats} from '../../classes/stats';
import {User} from '../../classes/user';

@Injectable({
  providedIn: 'root'
})
export class ProfileDomainService {
  normalizeUser(user: User): User {
    const defaultCharacter = this.createDefaultCharacter();
    const normalizedCharacter = {
      ...defaultCharacter,
      ...(user.character ?? {}),
      appearance: {
        ...defaultCharacter.appearance,
        ...(user.character?.appearance ?? {})
      }
    };

    return {
      ...user,
      character: normalizedCharacter,
      stats: user.stats ?? this.createDefaultStats()
    };
  }

  applyUpgradeLocally(user: User, param: string): void {
    if (param === 'hp') {
      user.character.maxHp += 15;
    } else if (param === 'chakra') {
      user.character.maxChakra += 7;
    } else if (param === 'damage') {
      user.character.physicalDamage += 4;
    } else {
      user.character.resistance += parseFloat(((1 - user.character.resistance) / 4).toFixed(2));
    }
    user.stats.upgradePoints--;
  }

  createDefaultStats(): Stats {
    return {
      fights: 0,
      wins: 0,
      losses: 0,
      deaths: 0,
      rating: 0,
      experience: 0,
      level: 1,
      upgradePoints: 0,
      spellPoints: 0
    };
  }

  private createDefaultCharacter(): Character {
    return {
      animalRace: undefined,
      cretionDate: undefined,
      appearance: this.createDefaultAppearance(),
      maxChakra: 30,
      maxHp: 100,
      user: undefined,
      physicalDamage: 10,
      resistance: 0.05,
      spellsKnown: [],
      fights: [],
      currentHP: 100,
      currentChakra: 30
    };
  }

  private createDefaultAppearance(): Appearance {
    return {
      gender: 'MALE',
      skinColour: 'WHITE',
      hairColour: 'YELLOW',
      clothesColour: 'GREEN'
    };
  }
}
