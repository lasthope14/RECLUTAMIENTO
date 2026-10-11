<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Documento de ingreso del aspirante. "codigo" es el tipo de documento del
 * catálogo de gestión (ING-CED, SO-EMO...). Mientras no se haya enviado a
 * gestión se puede reemplazar o borrar.
 */
class DocumentoAspirante extends Model
{
    protected $table = 'documentos_aspirante';

    /** Disco de los archivos (config/filesystems.php): <postulacion_id>/<uuid>.<ext> */
    public const DISCO = 'documentos';

    protected $fillable = [
        'postulacion_id',
        'codigo',
        'archivo',
        'archivo_nombre',
        'archivo_mime',
        'tamano',
        'fecha_expedicion',
        'fecha_vencimiento',
        'detalle',
        'user_id',
        'autor_nombre',
        'gestion_document_id',
        'ruta_nas',
        'enviado_at',
        'error_envio',
    ];

    protected $casts = [
        'fecha_expedicion' => 'date:Y-m-d',
        'fecha_vencimiento' => 'date:Y-m-d',
        'enviado_at' => 'datetime',
        'tamano' => 'integer',
    ];

    protected $hidden = ['archivo'];

    public function postulacion()
    {
        return $this->belongsTo(Postulacion::class);
    }

    public function enviado(): bool
    {
        return $this->gestion_document_id !== null;
    }
}
