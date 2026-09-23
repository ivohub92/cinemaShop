import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {}