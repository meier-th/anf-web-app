import {Component, Injector, OnInit} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {CookieService} from 'ngx-cookie-service';
import {MainComponent} from '../main/main.component';
import {Appearance} from '../classes/appearance';
import {TranslatePipe} from '../services/translate.pipe';
import {AuthApiService} from '../core/api/auth-api.service';
import {ApiConfigService} from '../core/config/api-config.service';

@Component({
  selector: 'app-auth',
  standalone: false,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.less']
})
export class AuthComponent implements OnInit {

  authMode: 'signin' | 'signup' = 'signin';
  username = '';
  firstPassword = '';
  secondPassword = '';
  parent = this.injector.get(MainComponent);
  registration = false;
  appearance = new Appearance();
  gender = false;

  constructor(private httpClient: HttpClient, private cookieService: CookieService, private injector: Injector,
    private pipe: TranslatePipe, private authApi: AuthApiService, private apiConfig: ApiConfigService) {
  }

  ngOnInit() {
    this.appearance.hairColour = 'YELLOW';
    this.appearance.clothesColour = 'GREEN';
    this.appearance.skinColour = 'WHITE';
    this.appearance.gender = 'MALE';
    this.changeClothes();
    this.changeHair();
    this.changeSkin();
  }

  tryToLogin() {
    if (this.username.length < 6) {
      this.parent.messageService.add({severity: 'error', summary: this.pipe.transform('Error'), detail: this.pipe.transform('Login is too short')});
    } else if (this.firstPassword.length < 6) {
      this.parent.messageService.add({severity: 'error', summary: this.pipe.transform('Error'), detail: this.pipe.transform('Password is too short')});
    } else {
      this.authApi.login(this.username, this.firstPassword).subscribe((response) => {
        console.log(response);
        this.parent.login = this.username;
        this.parent.loginSuccess();
        this.cookieService.set('username', this.username);
        this.cookieService.set('loggedIn', 'true');
      }, (error) => {
        this.parent.messageService.add({
          severity: 'error',
          summary: this.pipe.transform('Error'),
          detail: this.pipe.transform('Unauthorized')
        });
      });
    }
  }

  tryToSignUp() {
    if (this.username.length < 6) {
      this.parent.messageService.add({severity: 'error', summary: this.pipe.transform('Error'), detail: this.pipe.transform('Login is too short')});
    } else if (this.firstPassword.length < 6) {
      this.parent.messageService.add({severity: 'error', summary: this.pipe.transform('Error'), detail: this.pipe.transform('Password is too short')});
    } else if (this.firstPassword !== this.secondPassword) {
      this.parent.messageService.add({severity: 'error', summary: this.pipe.transform('Error'), detail: this.pipe.transform('Passwords are not the same')});
    } else {
      console.log('request sent');
      this.httpClient.post(this.apiConfig.buildUrl('/registration'), {
        login: this.username,
        password: this.firstPassword
      }).subscribe((response) => {
          console.log(response);
          this.registration = true;
          this.authApi.login(this.username, this.firstPassword).subscribe((response) => {
            console.log(response);
            // this.parent.loginSuccess();
            this.cookieService.set('username', this.username);
            this.cookieService.set('loggedIn', 'true');
            this.parent.loggedIn = true;
            this.parent.login = this.cookieService.get('username');
          }, (error) => {
            this.parent.messageService.add({
              severity: 'error',
              summary: this.pipe.transform('Error'),
              detail: this.pipe.transform('Unauthorized')
            });
          });
          this.parent.messageService.add({
            severity: 'success',
            summary: this.pipe.transform('Almost done'),
            detail: this.pipe.transform('Now create your character')
          });
        },
        (error: HttpErrorResponse) => {
          this.parent.messageService.add({
            severity: 'error',
            summary: this.pipe.transform('Error'),
            detail: error.message
          });
        });
    }
  }

  changeHair() {
    const array = document.getElementsByClassName('hair');
    let color = this.appearance.hairColour;
    switch (this.appearance.hairColour) {
      case 'YELLOW':
        color = '#DEAB7F';
        break;
      case 'BROWN':
        color = '#A53900';
        break;
      case 'BLACK':
        color = '#2D221C';
        break;
    }
    for (let i = 0; i < array.length; i++) {
      (<HTMLElement>array[i]).style.fill = color;
      (<HTMLElement>array[i]).style.stroke = color;
    }
  }

  changeSkin() {
    const array = document.getElementsByClassName('skin');
    let color = this.appearance.skinColour;
    switch (this.appearance.skinColour) {
      case 'BLACK':
        color = '#6E2B12';
        break;
      case 'WHITE':
        color = '#EBCCAB';
        break;
      case 'LATIN':
        color = '#C37C4D';
        break;
      case 'DARK':
        color = '#934C1D';
        break;
    }
    for (let i = 0; i < array.length; i++) {
      (<HTMLElement>array[i]).style.fill = color;
      (<HTMLElement>array[i]).style.stroke = color;
    }
  }

  changeClothes() {
    const array = document.getElementsByClassName('clothes');
    let color = this.appearance.clothesColour;
    switch (this.appearance.clothesColour) {
      case 'RED':
        color = 'crimson';
        break;
      case 'GREEN':
        color = '#81E890';
        break;
      case 'BLUE':
        color = 'cornflowerblue';
        break;
    }
    for (let i = 0; i < array.length; i++) {
      (<HTMLElement>array[i]).style.fill = color;
      (<HTMLElement>array[i]).style.stroke = color;
    }
  }

  setGender() {
    const males = document.getElementsByClassName('male');
    const females = document.getElementsByClassName('female');
    if (this.gender) {
      (<HTMLElement>females[0]).style.display = 'block';
      (<HTMLElement>males[0]).style.display = 'none';
    } else {
      (<HTMLElement>males[0]).style.display = 'block';
      (<HTMLElement>females[0]).style.display = 'none';
    }
    this.appearance.gender = this.gender ? 'FEMALE' : 'MALE';
  }

  sendAppearance() {
    this.httpClient.post(this.apiConfig.buildUrl('/profile/character/appearance'), null,
      {
        withCredentials: true,
        params: new HttpParams()
          .append('gender', this.appearance.gender)
          .append('hairColour', this.appearance.hairColour)
          .append('skinColour', this.appearance.skinColour)
          .append('clothesColour', this.appearance.clothesColour)
      }).subscribe((response) => {
      this.parent.dialog.close();
      this.parent.messageService.add({severity: 'success', summary: this.pipe.transform('Success'), detail: this.pipe.transform('You are successfully registered')});
    }, (error: HttpErrorResponse) => {
      this.parent.messageService.add({
        severity: 'error',
        summary: this.pipe.transform('Error'),
        detail: error.message
      });
    });
  }

  tryToSignInWithVk() {
    window.location.replace(this.apiConfig.buildUrl('/login/vk'));
  }

  tryToSignInWithGoogle() {
    window.location.replace(this.apiConfig.buildUrl('/login/google'));
  }
}
