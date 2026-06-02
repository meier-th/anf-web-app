import {Injectable} from '@angular/core';
import {User} from '../../classes/user';
import {Boss} from '../../classes/boss';

@Injectable({
  providedIn: 'root'
})
export class FightService {
  private _valuesSet  = false;
  private _id: string;
  private _type: string;
  private _author: string;

  get id(): string {
    return this._id;
  }

  set id(value: string) {
    this._id = value;
  }

  get type(): string {
    return this._type;
  }

  set type(value: string) {
    this._type = value;
  }

  get author(): string {
    return this._author;
  }

  set author(value: string) {
    this._author = value;
  }

  constructor() {
  }

  get valuesSet(): boolean {
    return this._valuesSet;
  }

  set valuesSet(value: boolean) {
    this._valuesSet = value;
  }
}
