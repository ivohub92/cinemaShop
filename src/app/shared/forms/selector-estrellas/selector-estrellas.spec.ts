import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectorEstrellas } from './selector-estrellas';

describe('SelectorEstrellas', () => {
  let component: SelectorEstrellas;
  let fixture: ComponentFixture<SelectorEstrellas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectorEstrellas],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectorEstrellas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
