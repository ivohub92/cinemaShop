import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GestionFunciones } from './gestion-funciones';

describe('GestionFunciones', () => {
  let component: GestionFunciones;
  let fixture: ComponentFixture<GestionFunciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionFunciones],
    }).compileComponents();

    fixture = TestBed.createComponent(GestionFunciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
