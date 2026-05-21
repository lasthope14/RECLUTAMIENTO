<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmailLog extends Model
{
    use HasFactory;

    protected $table = 'email_logs';

    protected $fillable = [
        'postulacion_id',
        'tipo',
        'asunto',
        'cuerpo',
        'estado',
        'error_mensaje',
        'enviado_en',
        'enviado_por',
    ];

    protected $casts = [
        'enviado_en' => 'datetime',
    ];

    public function postulacion()
    {
        return $this->belongsTo(Postulacion::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'enviado_por');
    }
}
