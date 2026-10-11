<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PerfilCargo extends Model
{
    use HasFactory;

    protected $table = 'perfiles_cargo';

    protected $fillable = [
        'nombre',
        'area',
        'ciudad',
        'descripcion',
        'requisitos',
        'salario_rango',
        'activo',
        'fecha_apertura',
        'fecha_cierre',
    ];

    protected $casts = [
        'requisitos' => 'array',
        'activo' => 'boolean',
        'fecha_apertura' => 'date',
        'fecha_cierre' => 'date',
    ];

    public function postulaciones()
    {
        return $this->hasMany(Postulacion::class);
    }

    public function evaluaciones()
    {
        return $this->hasMany(EvaluacionIa::class);
    }
}
