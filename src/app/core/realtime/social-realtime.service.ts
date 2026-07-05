import {Injectable} from '@angular/core';
import {CompatClient} from '@stomp/stompjs';
import {WebsocketGatewayService} from './websocket-gateway.service';

@Injectable({
  providedIn: 'root'
})
export class SocialRealtimeService {
  constructor(private wsGateway: WebsocketGatewayService) {}

  connect(onConnected: (client: CompatClient) => void): CompatClient {
    return this.wsGateway.acquire(onConnected);
  }

  subscribeOnline(client: CompatClient, handler: (body: string) => void): void {
    client.subscribe('/online', (message) => handler(message.body));
  }

  subscribeSocial(client: CompatClient, handler: (body: string) => void): void {
    client.subscribe('/user/social', (message) => handler(message.body));
  }

  subscribeUserMessages(client: CompatClient, handler: (body: string) => void): void {
    client.subscribe('/user/msg', (message) => handler(message.body));
  }

  subscribeAdminUpdates(client: CompatClient, handler: (body: string) => void): void {
    client.subscribe('/admin/admins', (message) => handler(message.body));
  }

  disconnect(client: CompatClient | null | undefined): void {
    this.wsGateway.release();
  }
}
