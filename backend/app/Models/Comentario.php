<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Comentario extends Model
{
    use HasFactory;

    protected $table = 'comentarios';

    protected $fillable = [
        'postulacion_id',
        'user_id',
        'autor_nombre',
        'comentario',
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
