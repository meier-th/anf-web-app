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
    const client = this.wsGateway.createClient();
    client.connect({}, () => {
      client.subscribe('/user/invite', (response) => onInvite(response.body));
      client.subscribe('/user/start', (response) => onStart(response.body));
    });
    return client;
  }

  disconnect(client: CompatClient | null | undefined): void {
    if (client?.connected) {
      client.disconnect(() => {});
    }
  }
}
