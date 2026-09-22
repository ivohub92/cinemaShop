import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SupabaseService } from './core/supabase/supabase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('cine');


  //prueba--------------------------
  private supabase = inject(SupabaseService);

  ngOnInit() {
    this.supabase.client.from('salas').select('id, nombre')
      .then(({ data, error }) => console.log({ data, error }));
  }
  //---------------------------
}