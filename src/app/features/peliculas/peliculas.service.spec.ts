import { TestBed } from '@angular/core/testing';
import { Peliculas } from './peliculas.service';

describe('Peliculas', () => {
  let service: Peliculas;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Peliculas);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
