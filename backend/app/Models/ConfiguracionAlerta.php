<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Un valor de la configuración de alertas (clave → valor JSON). */
class ConfiguracionAlerta extends Model
{
    protected $table = 'configuracion_alertas';

    protected $fillable = ['clave', 'valor'];

    protected $casts = ['valor' => 'array'];
}
