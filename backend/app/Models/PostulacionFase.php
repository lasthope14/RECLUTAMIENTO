<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Un movimiento del aspirante en el proceso de selección (historial). */
class PostulacionFase extends Model
{
    protected $table = 'postulacion_fases';

    public const UPDATED_AT = null;

    protected $fillable = [
        'postulacion_id',
        'fase',
        'evento',
        'observacion',
        'user_id',
        'autor_nombre',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function postulacion()
    {
        return $this->belongsTo(Postulacion::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
