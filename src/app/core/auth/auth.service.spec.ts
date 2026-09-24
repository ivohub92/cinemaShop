import { TestBed } from '@angular/core/testing';
import { Auth } from '../../src/app/core/auth/auth.service';

describe('Auth', () => {
  let service: Auth;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Auth);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
