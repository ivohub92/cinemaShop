import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormPelicula } from './form-pelicula';

describe('FormPelicula', () => {
  let component: FormPelicula;
  let fixture: ComponentFixture<FormPelicula>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormPelicula],
    }).compileComponents();

    fixture = TestBed.createComponent(FormPelicula);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
