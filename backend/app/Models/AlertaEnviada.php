<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Un correo de alerta enviado (o que falló al enviarse). */
class AlertaEnviada extends Model
{
    protected $table = 'alertas_enviadas';

    public const UPDATED_AT = null;

    protected $fillable = [
        'tipo',
        'postulacion_id',
        'referencia',
        'asunto',
        'destinatarios',
        'items',
        'resumen',
        'estado',
        'error',
    ];

    protected $casts = [
        'resumen' => 'array',
        'created_at' => 'datetime',
    ];

    public function postulacion()
    {
        return $this->belongsTo(Postulacion::class);
    }
}
