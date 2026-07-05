// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting()
);

import './app/core/config/api-config.service.unit.spec';
import './app/core/state/session.store.unit.spec';
import './app/core/domain/fight-combat-resolver.service.unit.spec';
import './app/core/facade/queue.facade.service.unit.spec';
