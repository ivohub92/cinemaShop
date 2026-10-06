import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MasVendidas } from '../mas-vendidas/mas-vendidas';

@Component({
  selector: 'app-home',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MasVendidas],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}