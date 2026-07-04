import {Injectable} from '@angular/core';
import {CompatClient} from '@stomp/stompjs';
import {FightStateEvent, SummonEvent} from '../domain/fight-combat.types';
import {WebsocketGatewayService} from './websocket-gateway.service';

/**
 * Dumb websocket transport for the fight screen: connects, parses JSON
 * payloads, and hands typed events to the caller. No game rules live here.
 */
@Injectable()
export class FightRealtimeService {
  private client?: CompatClient;

  constructor(private wsGateway: WebsocketGatewayService) {
  }

  connect(handlers: {
    onFightState: (event: FightStateEvent) => void;
    onTurnSwitch: (nextAttacker: string) => void;
    onSummon: (event: SummonEvent) => void;
  }): void {
    this.client = this.wsGateway.createClient();
    this.client.connect({}, () => {
      this.client.subscribe('/user/fightState', (response) => {
        handlers.onFightState(JSON.parse(response.body) as FightStateEvent);
      });
      this.client.subscribe('/user/switch', (response) => {
        handlers.onTurnSwitch(response.body);
      });
      this.client.subscribe('/user/summon', (response) => {
        handlers.onSummon(JSON.parse(response.body) as SummonEvent);
      });
    });
  }

  disconnect(): void {
    if (this.client?.connected) {
      this.client.disconnect(() => {
      });
    }
    this.client = undefined;
  }
}
