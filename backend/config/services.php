<?php

return [
    'gemini' => [
        'key'   => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-1.5-pro'),
    ],

    'hidroobras_id' => [
        'url' => env('HIDROOBRAS_ID_URL'),
        'client_id' => env('HIDROOBRAS_ID_CLIENT_ID'),
        'client_secret' => env('HIDROOBRAS_ID_CLIENT_SECRET'),
        'redirect' => env('HIDROOBRAS_ID_REDIRECT'),
    ],

    // App de gestión (gestion.hidroobras.com.co): al vincular un aspirante se
    // crea allá el empleado y se le envía la documentación, que termina en el
    // NAS. GESTION_API_KEY debe ser igual a RECLUTAMIENTO_API_KEY de gestión.
    'gestion' => [
        'url' => env('GESTION_API_URL', 'https://gestion.hidroobras.com.co/api/integration/recruitment'),
        'key' => env('GESTION_API_KEY'),
        // La vinculación (subir documentos al NAS) corre en esta conexión de
        // cola, en la cola "vinculacion", aunque el resto de la app use sync.
        // La atiende el worker "reclutamiento-queue" de PM2.
        'cola' => env('VINCULACION_QUEUE_CONNECTION', 'database'),
    ],
];
