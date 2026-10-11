<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Correo de alerta del proceso de selección (resumen diario o aviso de ARL). */
class AlertaMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $asunto,
        public readonly string $vista,
        public readonly array $datos,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->asunto);
    }

    public function content(): Content
    {
        return new Content(view: $this->vista, with: $this->datos + ['asunto' => $this->asunto]);
    }
}
