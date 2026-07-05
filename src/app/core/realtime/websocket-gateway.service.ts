import {Injectable} from '@angular/core';
import {CompatClient, Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {ApiConfigService} from '../config/api-config.service';

@Injectable({
  providedIn: 'root'
})
export class WebsocketGatewayService {
  private sharedClient: CompatClient | null = null;
  private sharedConnected = false;
  private pendingCallbacks: Array<(client: CompatClient) => void> = [];
  private refCount = 0;

  constructor(private apiConfig: ApiConfigService) {}

  createClient(socketPath = '/socket'): CompatClient {
    const ws = new SockJS(this.apiConfig.buildUrl(socketPath));
    return Stomp.over(ws);
  }

  /**
   * Invites, social presence, friends and chat all talk to the same '/socket'
   * STOMP endpoint. Sharing one connection instead of each feature opening its
   * own avoids a burst of redundant SockJS handshakes whenever the main page
   * loads. Every acquire() must be paired with exactly one release().
   *
   * ponytail: assumes each caller acquires/subscribes at most once per
   * acquire-release pair. If a caller ever needs to re-subscribe without first
   * releasing, this needs per-caller subscription-handle tracking to avoid
   * duplicate subscriptions on the shared client.
   */
  acquire(onConnected: (client: CompatClient) => void, socketPath = '/socket'): CompatClient {
    this.refCount++;
    if (!this.sharedClient) {
      this.sharedClient = this.createClient(socketPath);
      this.sharedClient.connect({}, () => {
        this.sharedConnected = true;
        const callbacks = this.pendingCallbacks.splice(0);
        callbacks.forEach((callback) => callback(this.sharedClient as CompatClient));
      });
    }
    if (this.sharedConnected) {
      onConnected(this.sharedClient);
    } else {
      this.pendingCallbacks.push(onConnected);
    }
    return this.sharedClient;
  }

  release(): void {
    if (this.refCount === 0) {
      return;
    }
    this.refCount--;
    if (this.refCount === 0 && this.sharedClient) {
      if (this.sharedClient.connected) {
        this.sharedClient.disconnect(() => {});
      }
      this.sharedClient = null;
      this.sharedConnected = false;
      this.pendingCallbacks.length = 0;
    }
  }
}
