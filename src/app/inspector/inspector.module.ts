import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InspectorRoutingModule } from './inspector-routing.module';
import { SharedModule } from '../shared/shared.module';
import { KlischeeAnalyserComponent } from './components/klischee-analyser/klischee-analyser.component';

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    InspectorRoutingModule,
    KlischeeAnalyserComponent
  ]
})
export class InspectorModule {}

