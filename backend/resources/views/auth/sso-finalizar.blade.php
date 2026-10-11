<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Hidroobras ID</title>
    <meta name="robots" content="noindex">
</head>
<body style="font-family: system-ui, sans-serif; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; color: #334155;">
    <p>Un momento...</p>

    <script>
        (function () {
            var token = @json($token);
            var usuario = @json($user);
            var destino = @json($destino);
            var enVentana = @json($popup);

            if (token) {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(usuario));
            }

            try {
                if (enVentana && window.opener && !window.opener.closed) {
                    window.opener.location.href = destino;
                    window.close();
                    return;
                }
            } catch (e) {
                // La ventana de origen ya no esta disponible.
            }

            window.location.replace(destino);
        })();
    </script>
</body>
</html>
