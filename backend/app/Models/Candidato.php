<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Candidato extends Model
{
    use HasFactory;

    protected $table = 'candidatos';

    protected $fillable = [
        'postulacion_id',
        'datos_extraidos',
        'resumen_ia',
        'estado_parseo',
        'error_parseo',
        'modelo_ia',
        'tokens_usados',
    ];

    protected $casts = [
        'datos_extraidos' => 'array',
    ];

    public function postulacion()
    {
        return $this->belongsTo(Postulacion::class);
    }

    public function evaluaciones()
    {
        return $this->hasMany(EvaluacionIa::class);
    }
}
