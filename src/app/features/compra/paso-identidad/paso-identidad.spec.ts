import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PasoIdentidad } from './paso-identidad';

describe('PasoIdentidad', () => {
  let component: PasoIdentidad;
  let fixture: ComponentFixture<PasoIdentidad>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PasoIdentidad],
    }).compileComponents();

    fixture = TestBed.createComponent(PasoIdentidad);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
