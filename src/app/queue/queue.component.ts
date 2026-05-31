import {Component, Injector, OnDestroy, OnInit} from '@angular/core';
import {AreaService} from '../services/area/area.service';
import {HttpClient, HttpParams, HttpSentEvent} from '@angular/common/http';
import {CookieService} from 'ngx-cookie-service';
import {Button} from 'primeng/button';
import {FightComponent} from '../fight/fight.component';
import {FightService} from '../services/fight/fight.service';
import {User} from '../classes/user';
import {MainComponent} from '../main/main.component';
import {CompatClient, Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {ProfilePageComponent} from '../profile-page/profile-page.component';

@Component({
  selector: 'app-queue',
  standalone: false,
  templateUrl: './queue.component.html',
  styleUrls: ['./queue.component.less']
})
export class QueueComponent implements OnInit, OnDestroy {

  area: string;
  users: string[];
  selected: string[];
  private stompClient: CompatClient;
  type: string;
  disabled: boolean;
  parent = this.injector.get(MainComponent);
  id: number;
  approved: string[];
  started = false;
  constructor(private areaService: AreaService, private http: HttpClient,
              private cookieService: CookieService, private fightService: FightService,
              private injector: Injector) {
  }

  ngOnInit() {
    this.area = this.areaService.selectedArea;
    this.type = this.areaService.pvp ? 'PVP' : 'PVE';
    console.log(this.areaService);
    this.http.get('http://localhost:8080/ready', {withCredentials: true}).subscribe((data: string[]) => {
      this.users = data.filter((item) => item !== this.cookieService.get('username'));
    });
    this.selected = [];
    this.disabled = this.areaService.pvp;
    this.initializeWebsockets();
    this.http.get('http://localhost:8080/fight/createQueue', {
      withCredentials: true
    }).subscribe((response: { queueId: number }) => {
      this.id = response.queueId;
    });
    this.approved = [];
  }

  validateAmount(event) {
    const max = this.areaService.pvp ? 1 : 5;
    if (this.selected.length > max) {
      this.users.push(this.selected.pop());
    }

    for (let i = 0; i < this.selected.length; i++) {
      this.send(this.areaService.pvp ? 'pvp' : 'pve', this.selected[i], this.id);
    }
  }

  startFight() {
    if (this.type === 'PVP') {
      this.http.get('http://localhost:8080/fight/startPvp', {
        withCredentials: true,
        params: new HttpParams().append('queueId', this.id.toString())
      }).subscribe((data: {
        id: number,
        type: string,
        fighters1: string[],
        fighters2: string[]
      }) => {
        this.started = true;
        console.log(data);
        this.parent.router.navigateByUrl('fight/' + this.type.toLowerCase() + '/' + data.id);
        this.parent.dialog.close();
      });

    } else {
      this.http.get('http://localhost:8080/fight/startPve', {
        withCredentials: true,
        params: new HttpParams().append('queueId', this.id.toString())
        .append('bossId', this.area)
      }).subscribe((data: {
        id: number
      }) => {
        this.started = true;
        console.log(data);
        this.parent.router.navigateByUrl('/fight/pve/' + data.id);
        this.parent.dialog.close();
      });
    }
  }

  send(type: string, username: string, id: number): void {
    this.disabled = true;
    this.http.get('http://localhost:8080/fight/invite', {
      withCredentials: true,
      params: new HttpParams()
        .append('type', type)
        .append('username', username)
        .append('id', id.toString())
    })
      .subscribe(() => {
        console.log(document.getElementsByClassName('ui-picklist-target'));
        const array = document.getElementsByClassName('ui-picklist-target')[0]
          .getElementsByClassName('ready');
        console.log(array);
        for (let j = 0; j < array.length; j++) {
          console.log(array[j]);
          array[j].classList.replace('ready', 'pending');
        }
      });
  }

  initializeWebsockets(): void {
    const ws = new SockJS('http://localhost:8080/socket');
    this.stompClient = Stomp.over(ws);
    const that = this;
    this.stompClient.connect({}, function (frame) {
      that.stompClient.subscribe('/user/approval', (message) => {
        console.log('Approval: ' + message);
        const username = message.body.substring(0, message.body.indexOf(':'));
        const pending = document.getElementsByClassName('ui-picklist-target')[0]
          .getElementsByClassName('pending');
        that.approved.push(username);
        that.checkReadiness();
        for (let i = 0; i < pending.length; i++) {
          if (pending[i].innerHTML.substring(1, pending[i].innerHTML.length - 1) === username) {
            pending[i].classList.replace('pending', 'ready');
            break;
          }
        }
      });
    });
  }

  checkReadiness() {
    let check = false;
    for (let i = 0; i < this.selected.length; i++) {
      if (!this.approved.includes(this.selected[i])) {
        check = true;
        break;
      }
    }
    if (this.areaService.pvp && this.selected.length < 1) {
      check = true;
    }
    this.disabled = check;
  }

  ngOnDestroy() {
    if (!this.started) {
      this.http.get('http://localhost:8080/fight/closeQueue', {
        withCredentials: true,
        params: new HttpParams().append('id', this.id.toString())
      }).subscribe();
    }
  }

}
