import {Injectable} from '@angular/core';
import {CompatClient} from '@stomp/stompjs';
import {WebsocketGatewayService} from './websocket-gateway.service';

@Injectable({
  providedIn: 'root'
})
export class InviteRealtimeService {
  constructor(private wsGateway: WebsocketGatewayService) {}

  connect(
    onInvite: (message: string) => void,
    onStart: (message: string) => void): CompatClient {
    return this.wsGateway.acquire((client) => {
      client.subscribe('/user/invite', (response) => onInvite(response.body));
      client.subscribe('/user/start', (response) => onStart(response.body));
    });
  }

  disconnect(client: CompatClient | null | undefined): void {
    this.wsGateway.release();
  }
}
