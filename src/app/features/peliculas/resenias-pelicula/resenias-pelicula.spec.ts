import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReseniasPelicula } from './resenias-pelicula';

describe('ReseniasPelicula', () => {
  let component: ReseniasPelicula;
  let fixture: ComponentFixture<ReseniasPelicula>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReseniasPelicula],
    }).compileComponents();

    fixture = TestBed.createComponent(ReseniasPelicula);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
