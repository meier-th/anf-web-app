import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AnimalRaceChoiceComponent } from './animal-race-choice.component';

describe('AnimalRaceChoiceComponent', () => {
  let component: AnimalRaceChoiceComponent;
  let fixture: ComponentFixture<AnimalRaceChoiceComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
    imports: [AnimalRaceChoiceComponent]
})
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AnimalRaceChoiceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
