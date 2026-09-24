import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListaPeliculas } from './lista-peliculas';

describe('ListaPeliculas', () => {
  let component: ListaPeliculas;
  let fixture: ComponentFixture<ListaPeliculas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListaPeliculas],
    }).compileComponents();

    fixture = TestBed.createComponent(ListaPeliculas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
