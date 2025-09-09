import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { KlischeeAnalyserComponent } from './components/klischee-analyser/klischee-analyser.component';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: KlischeeAnalyserComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class InspectorRoutingModule {}

