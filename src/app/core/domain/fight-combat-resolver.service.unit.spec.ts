import {Boss} from '../../classes/boss';
import {NinjaAnimal} from '../../classes/ninja-animal';
import {User} from '../../classes/user';
import {FightRoster, FightStateEvent} from './fight-combat.types';
import {FightCombatResolver} from './fight-combat-resolver.service';
import {FightDomainService} from './fight-domain.service';

function user(login: string): User {
  return {login} as User;
}

function animal(name: string): NinjaAnimal {
  return {name} as NinjaAnimal;
}

function baseEvent(overrides: Partial<FightStateEvent> = {}): FightStateEvent {
  return {
    attacker: '', target: '', attackName: 'Physical attack',
    chakraCost: 0, damage: 10, chakraBurn: 0,
    deadly: false, everyoneDead: false, nextAttacker: '',
    ...overrides
  };
}

describe('FightCombatResolver', () => {
  let resolver: FightCombatResolver;

  beforeEach(() => {
    resolver = new FightCombatResolver(new FightDomainService());
  });

  describe('PVP', () => {
    const ally = user('ally1');
    const enemy = user('enemy1');
    const allyAnimal = animal('vertet');
    const enemyAnimal = animal('lauva');
    const roster: FightRoster = {
      type: 'pvp',
      mySide: {users: [ally], animals: [allyAnimal]},
      otherSide: {users: [enemy], animals: [enemyAnimal]},
      pvpCurrentUserIsBackendSecond: false
    };

    it('resolves enemy user attacking my user', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: 'enemy1', target: 'ally1'}));
      expect(result.attacker).toEqual({kind: 'user', ref: enemy});
      expect(result.target).toEqual({kind: 'user', ref: ally});
      expect(result.yourSideAttacks).toBeFalse();
    });

    it('resolves my user attacking enemy animal', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: 'ally1', target: 'lau0'}));
      expect(result.attacker).toEqual({kind: 'user', ref: ally});
      expect(result.target).toEqual({kind: 'animal', ref: enemyAnimal});
      expect(result.yourSideAttacks).toBeTrue();
    });

    it('resolves my animal attacking enemy user', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: 'ver1', target: 'enemy1'}));
      expect(result.attacker).toEqual({kind: 'animal', ref: allyAnimal});
      expect(result.target).toEqual({kind: 'user', ref: enemy});
      expect(result.yourSideAttacks).toBeTrue();
    });

    it('resolves enemy animal attacking my animal', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: 'lau0', target: 'ver1'}));
      expect(result.attacker).toEqual({kind: 'animal', ref: enemyAnimal});
      expect(result.target).toEqual({kind: 'animal', ref: allyAnimal});
      expect(result.yourSideAttacks).toBeFalse();
    });

    it('flags surrender attacks case-insensitively', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: 'enemy1', target: 'ally1', attackName: 'Surrender'}));
      expect(result.isSurrender).toBeTrue();
    });
  });

  describe('PVE', () => {
    const ally = user('ally1');
    const allyAnimal = animal('vertet');
    const boss: Boss = {numberOfTails: 3} as Boss;
    const roster: FightRoster = {
      type: 'pve',
      mySide: {users: [ally], animals: [allyAnimal]},
      otherSide: {users: [], animals: []},
      boss,
      pvpCurrentUserIsBackendSecond: false
    };

    it('resolves my user attacking always targets the boss', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: 'ally1', target: 'irrelevant'}));
      expect(result.attacker).toEqual({kind: 'user', ref: ally});
      expect(result.target).toEqual({kind: 'boss', ref: boss});
      expect(result.yourSideAttacks).toBeTrue();
    });

    it('resolves my animal attacking always targets the boss', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: 'ver1', target: 'irrelevant'}));
      expect(result.attacker).toEqual({kind: 'animal', ref: allyAnimal});
      expect(result.target).toEqual({kind: 'boss', ref: boss});
      expect(result.yourSideAttacks).toBeTrue();
    });

    it('resolves the boss attacking my user (unmatched attacker token falls back to boss)', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: '3', target: 'ally1'}));
      expect(result.attacker).toEqual({kind: 'boss', ref: boss});
      expect(result.target).toEqual({kind: 'user', ref: ally});
      expect(result.yourSideAttacks).toBeFalse();
    });

    it('resolves the boss attacking my animal', () => {
      const result = resolver.resolve(roster, baseEvent({attacker: '3', target: 'ver1'}));
      expect(result.attacker).toEqual({kind: 'boss', ref: boss});
      expect(result.target).toEqual({kind: 'animal', ref: allyAnimal});
    });
  });

  it('reports isFightOver from everyoneDead', () => {
    const roster: FightRoster = {
      type: 'pvp',
      mySide: {users: [user('a')], animals: []},
      otherSide: {users: [user('b')], animals: []},
      pvpCurrentUserIsBackendSecond: false
    };
    const result = resolver.resolve(roster, baseEvent({attacker: 'a', target: 'b', everyoneDead: true}));
    expect(result.isFightOver).toBeTrue();
  });
});
