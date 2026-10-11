@extends('emails.layout-alerta')

@php
    $fila = 'padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;';
    $etq = 'color:#64748b;width:190px;';
    $pesos = fn ($v) => $v === null ? null : '$' . number_format($v, 0, ',', '.');
@endphp

@section('contenido')
    <p style="margin:0 0 14px;">Se cargó la <b>afiliación a la ARL</b> de un aspirante en el proceso de selección. Desde la afiliación la empresa paga ARL por cada día.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="{{ $fila }}{{ $etq }}">Aspirante</td><td style="{{ $fila }}"><b>{{ $caso['nombre'] }}</b></td></tr>
        @if ($caso['cedula'])<tr><td style="{{ $fila }}{{ $etq }}">Cédula</td><td style="{{ $fila }}">{{ $caso['cedula'] }}</td></tr>@endif
        <tr><td style="{{ $fila }}{{ $etq }}">Cargo</td><td style="{{ $fila }}">{{ $caso['cargo'] ?: '—' }}</td></tr>
        <tr><td style="{{ $fila }}{{ $etq }}">Fase del proceso</td><td style="{{ $fila }}">{{ $caso['fase'] ?: '—' }}</td></tr>
        <tr><td style="{{ $fila }}{{ $etq }}">Fecha de afiliación</td><td style="{{ $fila }}">{{ $caso['fecha_afiliacion'] }}</td></tr>
        <tr><td style="{{ $fila }}{{ $etq }}">Ingreso previsto</td><td style="{{ $fila }}"><b>{{ $caso['fecha_ingreso'] }}</b></td></tr>
        @if ($caso['clase_riesgo'])<tr><td style="{{ $fila }}{{ $etq }}">Clase de riesgo</td><td style="{{ $fila }}">{{ $caso['clase_riesgo'] }}</td></tr>@endif
        @if ($caso['costo_dia'] !== null)<tr><td style="{{ $fila }}{{ $etq }}">Costo ARL estimado por día</td><td style="{{ $fila }}">{{ $pesos($caso['costo_dia']) }}</td></tr>@endif
    </table>

    <p style="margin:16px 0 0;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;color:#991b1b;font-size:13px;">
        Si pasados {{ $plazo }} día(s) hábil(es) de la fecha de ingreso la persona no se ha vinculado o no ha marcado asistencia, aparecerá en el resumen diario hasta que se confirme su ingreso o se reporte el retiro ante la ARL.
    </p>
@endsection
