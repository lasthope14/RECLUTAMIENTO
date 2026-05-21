<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EvaluacionIa extends Model
{
    use HasFactory;

    protected $table = 'evaluaciones_ia';

    protected $fillable = [
        'candidato_id',
        'perfil_cargo_id',
        'puntaje_total',
        'puntaje_educacion',
        'puntaje_experiencia',
        'puntaje_habilidades',
        'puntaje_perfil_general',
        'fortalezas',
        'brechas',
        'justificacion',
        'recomendacion',
        'modelo_ia',
        'tokens_usados',
    ];

    protected $casts = [
        'puntaje_total' => 'decimal:2',
        'puntaje_educacion' => 'decimal:2',
        'puntaje_experiencia' => 'decimal:2',
        'puntaje_habilidades' => 'decimal:2',
        'puntaje_perfil_general' => 'decimal:2',
        'fortalezas' => 'array',
        'brechas' => 'array',
    ];

    public function candidato()
    {
        return $this->belongsTo(Candidato::class);
    }

    public function perfilCargo()
    {
        return $this->belongsTo(PerfilCargo::class);
    }
}
