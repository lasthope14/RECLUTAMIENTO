<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Postulacion extends Model
{
    use HasFactory;

    protected $table = 'postulaciones';

    protected $fillable = [
        'perfil_cargo_id',
        'nombre_completo',
        'email',
        'telefono',
        'fuente',
        'estado',
        'email_origen',
        'asunto_email',
        'cuerpo_email',
        'archivo_cv',
        'archivo_nombre',
        'archivo_mime',
        'mensaje_id_email',
        'notas_hr',
        'fecha_recepcion',
    ];

    protected $casts = [
        'fecha_recepcion' => 'datetime',
    ];

    public function perfilCargo()
    {
        return $this->belongsTo(PerfilCargo::class);
    }

    public function candidato()
    {
        return $this->hasOne(Candidato::class);
    }

    public function emailLogs()
    {
        return $this->hasMany(EmailLog::class);
    }
}
