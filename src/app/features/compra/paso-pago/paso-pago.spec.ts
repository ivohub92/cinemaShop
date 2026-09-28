import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasoPago } from './paso-pago';

describe('PasoPago', () => {
  let component: PasoPago;
  let fixture: ComponentFixture<PasoPago>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasoPago],
    }).compileComponents();

    fixture = TestBed.createComponent(PasoPago);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
