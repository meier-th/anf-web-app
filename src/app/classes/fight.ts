import { Boss } from './boss'
import { Character } from './character';

export class FightVsAI {

    id: number;
    fight_date: Date;
    boss: Boss;
    setFighters: Character[];
    
}

export class FightPVP {

    pvpId: number;
    firstFighter: Character;
    secondFighter: Character;
    fightDate: Date;
    firstWon: boolean;
    ratingChange: number;
    biggerRatingChange: number;
    lessRatingChange: number;

}
