import { Pipe, PipeTransform } from '@angular/core';
import { Userdata } from '../classes/userdata';

@Pipe({ name: 'searchUsers' })
export class SearchUsersPipe implements PipeTransform {

  transform(items: Userdata[], searchText: string): any[] {
    if (!items)
      return [];
    if (!searchText)
      return items;
    searchText = searchText.toLowerCase();
    return items.filter(item => {
      return item.user.login.toLowerCase().includes(searchText);
    });
  }

}
