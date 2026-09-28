import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidarEntrada } from './validar-entrada';

describe('ValidarEntrada', () => {
  let component: ValidarEntrada;
  let fixture: ComponentFixture<ValidarEntrada>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ValidarEntrada],
    }).compileComponents();

    fixture = TestBed.createComponent(ValidarEntrada);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
