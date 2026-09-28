import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasoConfirmacion } from './paso-confirmacion';

describe('PasoConfirmacion', () => {
  let component: PasoConfirmacion;
  let fixture: ComponentFixture<PasoConfirmacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasoConfirmacion],
    }).compileComponents();

    fixture = TestBed.createComponent(PasoConfirmacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
