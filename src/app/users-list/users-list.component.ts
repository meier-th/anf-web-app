import { Component, OnInit, Injector } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import {User} from '../classes/user';
import { FriendsPageComponent } from '../friends-page/friends-page.component';
import {SingleMessageComponent} from '../single-message/single-message.component';
import {ConfirmationService, MessageService} from 'primeng/api';
import {DialogService, DynamicDialogRef} from 'primeng/dynamicdialog';
import { SingleMessageService } from '../services/single-message.service';
import {Stomp} from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Userdata } from '../classes/userdata';

@Component({
  selector: 'app-users-list',
  standalone: false,
  templateUrl: './users-list.component.html',
  styleUrls: ['./users-list.component.less'],
  providers: [DialogService, ConfirmationService]
})
export class UsersListComponent implements OnInit {

  searchText = '';
  usersList: Userdata[];
  viewer: User;
  private stompClient;
  private adminView: boolean = false;
  private dialog: DynamicDialogRef;


  constructor(private http: HttpClient, private injector: Injector, private messageServ: SingleMessageService,
    private dialogService: DialogService, private confirmationService: ConfirmationService) { }

  ngOnInit() {
        let tempUsrs: Userdata[] = [];
        this.http.get<User[]>('http://localhost:8080/users', {withCredentials: true})
            .subscribe(dt => {
              dt.forEach(usr => {
                var usrdt = new Userdata();
                usrdt.user = usr;
                if (usr.roles.map(role => role.role).includes('ADMIN'))  {
                  usrdt.admin = true;
                  usrdt.notAdmin = false;
                } else {
                  usrdt.admin = false;
                  usrdt.notAdmin = true;
                }
                usrdt.friend = false;
                usrdt.requested = false;
                usrdt.requesting = false;
                usrdt.noRelations = true;
                tempUsrs.push(usrdt);
              });
              this.http.get<User[]>('http://localhost:8080/friends/requests/outgoing',
                {withCredentials: true}).subscribe(dt => {
                  tempUsrs.forEach(ud => {
                    if (dt.map(u => u.login).includes(ud.user.login)) {
                      ud.requested = true;
                      ud.noRelations = false;
                    }
                  });
                  this.http.get<User[]>('http://localhost:8080/friends/requests/incoming',
                    {withCredentials: true}).subscribe(dt => {
                      tempUsrs.forEach(ud => {
                        if (dt.map(u => u.login).includes(ud.user.login)) {
                          ud.requesting = true;
                          ud.noRelations = false;
                        }
                      });
                      this.http.get<User>('http://localhost:8080/profile', {withCredentials: true})
                        .subscribe(usr => {
                          this.viewer = usr;
                          if (this.viewer.roles.map(role => role.role).includes('ADMIN')) 
                            this.adminView = true;
                            this.initializeWebSockets();
                          tempUsrs.forEach(ud => {
                            if (ud.user.login === this.viewer.login)
                              tempUsrs.splice(tempUsrs.indexOf(ud), 1);
                          });
                          this.http.get<User[]>('http://localhost:8080/friends', {withCredentials: true})
                            .subscribe(data => {
                              tempUsrs.forEach(ud => {
                                if (data.map(u => u.login).includes(ud.user.login)) {
                                  ud.friend = true;
                                  ud.noRelations = false;
                                }
                              });
                              var ready: string[] = [];
                              this.http.get<string[]>('http://localhost:8080/ready', {withCredentials: true})
                                .subscribe(rd => {
                                  ready = rd;
                                  tempUsrs.forEach(ud => {
                                    if (ready.includes(ud.user.login)) {
                                      ud.user.online = true;
                                      ud.user.offline = false;
                                    } else {
                                      ud.user.online = false;
                                      ud.user.offline = true;
                                    }
                                  });
                                  this.usersList = tempUsrs; 
                                });
                            });
                        });
                    });
                });
            });  
      
  }

  initializeWebSockets(): void {
    let ws = new SockJS("http://localhost:8080/socket");
    this.stompClient = Stomp.over(ws);
    let that = this;
    this.stompClient.connect({}, function(frame) {
      that.stompClient.subscribe("/online", (message) => {
        var str = message.body; //format: {online/offline/new}:{username}
        var i = str.indexOf(':');
        var type = str.substring(0, i);
        var user = str.substring(i+1, str.length);
        if (type !== 'new')
        that.usersList.forEach(ud => {
          if (ud.user.login === user) {
            if (type === 'online') {
              ud.user.offline = false;
              ud.user.online = true;
            } else {
              ud.user.offline = true;
              ud.user.online = false;
            }
          }
        });
        else {
          var newUser: User;
          that.http.get<User>('http://localhost:8080/users/'+user, {withCredentials: true})
            .subscribe(usr => {
              newUser = usr;
              var newUd: Userdata = new Userdata();
          newUd.admin = false;
          newUd.friend = false;
          newUd.noRelations = true;
          newUd.notAdmin = true;
          newUd.requested = false;
          newUd.requesting = false;
          newUd.user = newUser;
          that.usersList.push(newUd);
            });
          
        }
    });
      that.stompClient.subscribe("/user/social", message => {
        var str = message.body;
        var i = str.indexOf(':');
        var event = str.substring(0, i);
        if (event === 'friend') {
          var type = str.substring(i+1, i+2);
          var username = str.substring(i+2, str.length);
          console.log('usersList: friend '+type+' '+username+';');
          that.usersList.forEach(ud => {
            if (ud.user.login === username){
              if (type === '+' || type === 'o') {
                ud.friend = true;
                ud.requested = false;
                ud.requesting = false;
              } else {
                ud.friend = false;
                ud.noRelations = true;
              }
            }
          });
        } else if (event = 'request') {
          var type = str.substring(i+1, i+2);
          var username = str.substring(i+2, str.length);
          that.usersList.forEach(ud => {
            if (ud.user.login === username) {
              if (type === '+') {
                ud.requesting = true;
                ud.noRelations = false;
              } else if (type === '-') {
                ud.requesting = false;
                ud.noRelations = true;
              } else if (type === '/'){
                ud.requested = false;
                ud.noRelations = true;
              }
            }
          });
        } else if (event === 'decline'){
          var username = str.substring(i+1, str.length);
          that.usersList.forEach(ud => {
            if (ud.user.login === username) {
              ud.requested = false;
              ud.noRelations = true;
            }
          });
        } 
      });
      if (that.adminView) {
        that.stompClient.subscribe("/admin/admins", message => {
          var logn = message.body;
          that.usersList.forEach(ud => {
            if (ud.user.login === logn) {
              ud.admin = true;
              ud.notAdmin = false;
            }
          });
        });
      }
    });
  }


  deleteReq(ud: Userdata): void {
    this.http.delete<string>('http://localhost:8080/profile/friends/requests',
      {withCredentials: true, params: new HttpParams().append('username', ud.user.login).append('type', 'out')}).subscribe();
    ud.noRelations = true;
    ud.requested = false;
  }

  declineReq(ud: Userdata): void {
    this.http.delete<string>('http://localhost:8080/profile/friends/requests',
      {withCredentials: true, params: new HttpParams().append('username', ud.user.login).append('type', 'in')}).subscribe();
    ud.noRelations = true;
    ud.requesting = false;
  }

  acceptReq(ud: Userdata): void {
    this.http.post('http://localhost:8080/profile/friends', 
    new HttpParams().set('login', ud.user.login),
    { headers:
      new HttpHeaders (
      {   
          "Content-Type": "application/x-www-form-urlencoded"
      }), 
    withCredentials: true }).subscribe( msg => {});
    ud.friend = true;
    ud.requesting = false;
  }

  sendRequest(ud: Userdata): void {
    this.http.post('http://localhost:8080/profile/friends/requests', 
    new HttpParams().set('username', ud.user.login),
    { headers:
      new HttpHeaders (
      {   
          "Content-Type": "application/x-www-form-urlencoded"
      }), 
    withCredentials: true }).subscribe( msg => {});
    ud.noRelations = false;
    ud.requested = true;
  }

  openMessageWindow(ud: Userdata): void {
    this.messageServ.username = ud.user.login;
    
    this.dialog = this.dialogService.open(SingleMessageComponent, {
      width: '800px', height: '400px'
    });
    this.messageServ.closingObj = this.dialog;
  }

  grantAdmin(ud: Userdata): void {
    var url = 'http://localhost:8080/admin/users/'+ud.user.login+'/grantAdmin';
    this.http.post(url, 
    new HttpParams(),
    { headers:
      new HttpHeaders (
      {   
          "Content-Type": "application/x-www-form-urlencoded"
      }), 
    withCredentials: true }).subscribe( msg => {});
    ud.admin = true;
    ud.notAdmin = false;
  }

}
