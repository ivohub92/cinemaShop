import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PanelLateral } from './panel-lateral';

describe('PanelLateral', () => {
  let component: PanelLateral;
  let fixture: ComponentFixture<PanelLateral>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PanelLateral],
    }).compileComponents();

    fixture = TestBed.createComponent(PanelLateral);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
