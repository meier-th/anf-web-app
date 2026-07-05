import {SpellHandling} from '../../classes/spell-handling';
import {Spell} from '../../classes/spell';
import {scaledSpellStats} from './fight-session.service';

function handling(spellLevel: number): SpellHandling {
  const spellUse = new Spell(1, 'Earth Strike', 12, 7, 3, 3);
  return {spellUse, handlingId: 1, spellLevel} as SpellHandling;
}

describe('scaledSpellStats', () => {
  it('scales damage up and chakra cost down as spell level increases', () => {
    const base = scaledSpellStats(handling(0));
    const leveled = scaledSpellStats(handling(3));

    expect(base).toEqual({damage: 12, chakra: 7});
    expect(leveled).toEqual({damage: 21, chakra: 0});
  });
});
