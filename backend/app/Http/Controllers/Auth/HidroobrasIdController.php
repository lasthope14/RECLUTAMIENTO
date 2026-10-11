<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Inicio de sesion con Hidroobras ID (OAuth2 authorization code + PKCE).
 *
 * Aplicacion PRIVADA: Hidroobras ID dice quien es la persona, pero solo entra
 * si su correo ya esta registrado aqui. Nunca se crean usuarios desde este flujo.
 *
 * El panel de React se autentica con un token de Sanctum en localStorage, asi
 * que al terminar se emite el mismo tipo de token que da POST /api/login.
 */
class HidroobrasIdController extends Controller
{
    public function redirect(Request $request): RedirectResponse
    {
        $request->session()->put('sso_state', $state = Str::random(40));
        $request->session()->put('sso_verifier', $verifier = Str::random(128));

        // ?popup=1 lo pone el boton del login cuando logra abrir la ventana
        // emergente. Si el navegador la bloquea, el flujo sigue con redireccion.
        $request->session()->put('sso_popup', $request->boolean('popup'));

        $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

        return redirect()->away(rtrim(config('services.hidroobras_id.url'), '/') . '/oauth/authorize?' . http_build_query([
            'client_id' => config('services.hidroobras_id.client_id'),
            'redirect_uri' => config('services.hidroobras_id.redirect'),
            'response_type' => 'code',
            'scope' => 'profile',
            'state' => $state,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
        ]));
    }

    public function callback(Request $request): Response
    {
        $expectedState = $request->session()->pull('sso_state');
        $verifier = $request->session()->pull('sso_verifier');
        $popup = (bool) $request->session()->pull('sso_popup');

        if ($request->filled('error')) {
            return $this->fail('Se cancelo el inicio de sesion con Hidroobras ID.', $popup);
        }

        if (blank($expectedState) || !hash_equals($expectedState, (string) $request->state) || blank($request->code)) {
            return $this->fail('La solicitud de inicio de sesion expiro. Intentalo de nuevo.', $popup);
        }

        $base = rtrim(config('services.hidroobras_id.url'), '/');

        try {
            $token = Http::asForm()->timeout(15)->post($base . '/oauth/token', [
                'grant_type' => 'authorization_code',
                'client_id' => config('services.hidroobras_id.client_id'),
                'client_secret' => config('services.hidroobras_id.client_secret'),
                'redirect_uri' => config('services.hidroobras_id.redirect'),
                'code_verifier' => $verifier,
                'code' => $request->code,
            ])->throw()->json();

            $claims = Http::withToken($token['access_token'])->acceptJson()->timeout(15)
                ->get($base . '/api/userinfo')
                ->throw()
                ->json();
        } catch (ConnectionException|RequestException $e) {
            Log::error('Hidroobras ID: fallo el intercambio del codigo', ['error' => $e->getMessage()]);

            return $this->fail('No fue posible comunicarse con Hidroobras ID. Intentalo de nuevo en unos minutos.', $popup);
        }

        $email = strtolower(trim((string) ($claims['email'] ?? '')));

        if (!str_ends_with($email, '@hidroobras.com.co')) {
            return $this->fail('Solo se permiten cuentas corporativas @hidroobras.com.co.', $popup);
        }

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            Log::warning('Hidroobras ID: intento de ingreso sin acceso', ['email' => $email, 'ip' => $request->ip()]);

            return $this->fail('No tienes acceso a Reclutamiento. Solicitalo al administrador.', $popup);
        }

        $sanctumToken = $user->createToken('hr-panel-sso')->plainTextToken;

        Log::info('Hidroobras ID: inicio de sesion', ['user_id' => $user->id, 'ip' => $request->ip()]);

        return $this->finish([
            'token' => $sanctumToken,
            'user' => $user->toArray(),
            'destino' => '/dashboard',
        ], $popup);
    }

    private function fail(string $message, bool $popup): Response
    {
        return $this->finish([
            'token' => null,
            'user' => null,
            'destino' => '/login?' . http_build_query(['sso_error' => $message]),
        ], $popup);
    }

    /**
     * Pagina intermedia que guarda la sesion del panel y se va al destino.
     * localStorage es comun a todas las ventanas del mismo sitio, asi que la
     * ventana emergente puede dejar el token listo para la pagina de origen.
     */
    private function finish(array $datos, bool $popup): Response
    {
        return response()
            ->view('auth.sso-finalizar', $datos + ['popup' => $popup])
            ->header('Cache-Control', 'no-store, private')
            ->header('Referrer-Policy', 'no-referrer');
    }
}
