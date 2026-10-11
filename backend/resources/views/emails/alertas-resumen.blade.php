@extends('emails.layout-alerta')

@php
    $th = 'text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;padding:6px 8px;border-bottom:1px solid #e2e8f0;';
    $td = 'padding:7px 8px;border-bottom:1px solid #f1f5f9;font-size:13px;vertical-align:top;';
    $h = 'margin:24px 0 4px;font-size:15px;font-weight:700;';
    $sub = 'margin:0 0 8px;font-size:12px;color:#64748b;';
    $max = 30;
    $estadosArl = [
        'no_continuo' => 'Se afilió y NO continuó en el proceso',
        'sin_vincular' => 'Pasó la fecha de ingreso y no se ha vinculado',
        'sin_marcacion' => 'Vinculado, sin ninguna marcación de asistencia',
    ];
    $pesos = fn ($v) => $v === null ? '—' : '$' . number_format($v, 0, ',', '.');
@endphp

@section('contenido')
    @if ($total === 0)
        <p>No hay pendientes vencidos. ¡Todo al día!</p>
    @else
        <p style="margin:0;">Hay <b>{{ $total }}</b> pendiente(s) que ya pasaron su plazo.</p>
    @endif

    @if ($pendientes['arl']->isNotEmpty())
        <div style="{{ $h }}color:#b91c1c;">Afiliados a la ARL sin ingreso ({{ $pendientes['arl']->count() }})</div>
        <p style="{{ $sub }}">La ARL se paga por día. Si la persona no va a ingresar, reporte el retiro ante la ARL cuanto antes y márquelo en la plataforma.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><th style="{{ $th }}">Aspirante</th><th style="{{ $th }}">Situación</th><th style="{{ $th }}">Afiliación / ingreso</th><th style="{{ $th }}">Días pagados</th><th style="{{ $th }}">Costo est.</th></tr>
            @foreach ($pendientes['arl'] as $c)
                <tr>
                    <td style="{{ $td }}"><b>{{ $c['nombre'] }}</b>@if($c['cedula'])<br><span style="color:#64748b;">C.C. {{ $c['cedula'] }}</span>@endif<br><span style="color:#64748b;">{{ $c['cargo'] }}</span></td>
                    <td style="{{ $td }}color:#b91c1c;">{{ $estadosArl[$c['estado']] ?? $c['estado'] }}</td>
                    <td style="{{ $td }}">{{ $c['fecha_afiliacion'] }}<br><span style="color:#64748b;">ingreso {{ $c['fecha_ingreso'] }}</span></td>
                    <td style="{{ $td }}"><b>{{ $c['dias_sin_trabajo'] }}</b></td>
                    <td style="{{ $td }}">{{ $pesos($c['costo_estimado']) }}</td>
                </tr>
            @endforeach
        </table>
    @endif

    @if ($pendientes['fases_estancadas']->isNotEmpty())
        <div style="{{ $h }}color:#b45309;">Aspirantes detenidos en una fase ({{ $pendientes['fases_estancadas']->count() }})</div>
        <p style="{{ $sub }}">No responden, falta documentación o falta avanzarlos. Apruebe la fase, márquela como no aprobada o contacte al aspirante.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><th style="{{ $th }}">Aspirante</th><th style="{{ $th }}">Fase</th><th style="{{ $th }}">Días hábiles</th><th style="{{ $th }}">Pendiente</th></tr>
            @foreach ($pendientes['fases_estancadas']->take($max) as $i)
                <tr>
                    <td style="{{ $td }}"><b>{{ $i['nombre'] }}</b><br><span style="color:#64748b;">{{ $i['cargo'] }}</span></td>
                    <td style="{{ $td }}">{{ $i['fase'] }}</td>
                    <td style="{{ $td }}"><b>{{ $i['dias'] }}</b> <span style="color:#64748b;">(plazo {{ $i['plazo'] }})</span></td>
                    <td style="{{ $td }}">{{ $i['documentos_faltantes'] ? 'Faltan: ' . implode(', ', $i['documentos_faltantes']) : '—' }}</td>
                </tr>
            @endforeach
        </table>
        @if ($pendientes['fases_estancadas']->count() > $max)<p style="{{ $sub }}">… y {{ $pendientes['fases_estancadas']->count() - $max }} más.</p>@endif
    @endif

    @if ($pendientes['sin_respuesta']->isNotEmpty())
        <div style="{{ $h }}">Descartados sin respuesta ({{ $pendientes['sin_respuesta']->count() }})</div>
        <p style="{{ $sub }}">Llevan más de {{ $config['dias_respuesta_descartado'] }} días hábiles descartados y no se les ha enviado ningún correo.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><th style="{{ $th }}">Aspirante</th><th style="{{ $th }}">Dónde salió</th><th style="{{ $th }}">Días hábiles</th></tr>
            @foreach ($pendientes['sin_respuesta']->take($max) as $i)
                <tr>
                    <td style="{{ $td }}"><b>{{ $i['nombre'] }}</b><br><span style="color:#64748b;">{{ $i['email'] ?: 'sin correo registrado' }}</span></td>
                    <td style="{{ $td }}">{{ $i['fase'] }}</td>
                    <td style="{{ $td }}">{{ $i['dias'] }}</td>
                </tr>
            @endforeach
        </table>
        @if ($pendientes['sin_respuesta']->count() > $max)<p style="{{ $sub }}">… y {{ $pendientes['sin_respuesta']->count() - $max }} más.</p>@endif
    @endif

    @if ($pendientes['hv_sin_revisar']->isNotEmpty())
        <div style="{{ $h }}">Hojas de vida sin revisar ({{ $pendientes['hv_sin_revisar']->count() }})</div>
        <p style="{{ $sub }}">Recibidas hace más de {{ $config['dias_hv_sin_revisar'] }} días hábiles y aún en estado «Recibida».</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><th style="{{ $th }}">Aspirante</th><th style="{{ $th }}">Cargo</th><th style="{{ $th }}">Recibida</th><th style="{{ $th }}">Días hábiles</th></tr>
            @foreach ($pendientes['hv_sin_revisar']->take($max) as $i)
                <tr>
                    <td style="{{ $td }}"><b>{{ $i['nombre'] }}</b></td>
                    <td style="{{ $td }}">{{ $i['cargo'] ?: '—' }}</td>
                    <td style="{{ $td }}">{{ $i['desde'] }}</td>
                    <td style="{{ $td }}">{{ $i['dias'] }}</td>
                </tr>
            @endforeach
        </table>
        @if ($pendientes['hv_sin_revisar']->count() > $max)<p style="{{ $sub }}">… y {{ $pendientes['hv_sin_revisar']->count() - $max }} más.</p>@endif
    @endif
@endsection
