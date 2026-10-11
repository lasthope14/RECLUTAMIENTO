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
        'ciudad',
        'fuente',
        'estado',
        'marcada',
        'email_origen',
        'asunto_email',
        'cuerpo_email',
        'archivo_cv',
        'archivo_nombre',
        'archivo_mime',
        'mensaje_id_email',
        'notas_hr',
        'fecha_recepcion',
        'fase',
        'fase_desde',
        'cedula',
        'datos_vinculacion',
        'gestion_employee_id',
        'vinculado_at',
        'vinculado_por',
        'vinculacion_estado',
        'vinculacion_mensaje',
        'vinculacion_solicitada_at',
        'arl_seguimiento',
        'arl_seguimiento_fecha',
        'arl_seguimiento_por',
        'arl_seguimiento_nota',
    ];

    protected $casts = [
        'fecha_recepcion'   => 'datetime',
        'marcada'           => 'boolean',
        'fase_desde'        => 'datetime',
        'datos_vinculacion' => 'array',
        'vinculado_at'      => 'datetime',
        'vinculacion_solicitada_at' => 'datetime',
        'arl_seguimiento_fecha' => 'date:Y-m-d',
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

    public function comentarios()
    {
        return $this->hasMany(Comentario::class)->latest();
    }

    /** Historial del proceso de selección, del más antiguo al más reciente. */
    public function fases()
    {
        return $this->hasMany(PostulacionFase::class)->orderBy('created_at')->orderBy('id');
    }

    public function documentos()
    {
        return $this->hasMany(DocumentoAspirante::class)->orderBy('codigo')->orderBy('id');
    }
}
