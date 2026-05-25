import {ApiConfigService} from './api-config.service';

describe('ApiConfigService', () => {
  it('builds absolute urls from slash paths', () => {
    const service = new ApiConfigService();

    expect(service.buildUrl('/profile')).toContain('/profile');
    expect(service.buildUrl('/profile')).toContain('http://localhost:31480');
  });

  it('normalizes paths without leading slash', () => {
    const service = new ApiConfigService();

    expect(service.buildUrl('fight/queue')).toBe('http://localhost:31480/fight/queue');
  });
});
