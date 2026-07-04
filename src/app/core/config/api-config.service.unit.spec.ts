import {ApiConfigService} from './api-config.service';
import {environment} from '../../../environments/environment';

describe('ApiConfigService', () => {
  it('builds absolute urls from slash paths', () => {
    const service = new ApiConfigService();

    expect(service.buildUrl('/profile')).toBe(`${environment.apiBaseUrl}/profile`);
  });

  it('normalizes paths without leading slash', () => {
    const service = new ApiConfigService();

    expect(service.buildUrl('fight/queue')).toBe(`${environment.apiBaseUrl}/fight/queue`);
  });
});
