<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && $request->user()->role_id === 1) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Acceso denegado: Se requieren privilegios de administrador para realizar esta operación.'
        ], 403);
    }
}
