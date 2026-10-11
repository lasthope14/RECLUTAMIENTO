<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{{ $asunto }}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #e2e8f0;">
          <img src="https://reclutamiento.hidroobras.com.co/assets/logo.png" alt="Hidroobras S.A.S" style="max-width:160px;height:auto;">
          <div style="margin-top:14px;font-size:18px;font-weight:700;color:#1e3a8a;">{{ $asunto }}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">{{ now()->locale('es')->translatedFormat('l j \d\e F \d\e Y') }}</div>
        </td></tr>
        <tr><td style="padding:22px 28px;font-size:14px;line-height:1.5;">
          @yield('contenido')
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          <a href="{{ $urlApp }}/seleccion" style="color:#2563eb;font-weight:600;">Abrir el proceso de selección</a>
          · Los plazos se cuentan en días hábiles y se ajustan en la pantalla de Alertas.
          <br>Correo automático de la plataforma de reclutamiento de Hidroobras.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
