import {Injectable} from '@angular/core';
import {CompatClient, Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {ApiConfigService} from '../config/api-config.service';

@Injectable({
  providedIn: 'root'
})
export class WebsocketGatewayService {
  constructor(private apiConfig: ApiConfigService) {}

  createClient(socketPath = '/socket'): CompatClient {
    const ws = new SockJS(this.apiConfig.buildUrl(socketPath));
    return Stomp.over(ws);
  }
}
