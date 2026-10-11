<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with('role');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Return users ordered by name
        return response()->json($query->orderBy('name')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'role_id'  => 'nullable|integer|exists:roles,id',
        ]);

        $user = User::create([
            'name'     => $validated['name'],
            'email'    => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role_id'  => $validated['role_id'] ?? 2,
        ]);

        return response()->json($user, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(User $usuario): JsonResponse
    {
        return response()->json($usuario);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $usuario): JsonResponse
    {
        $validated = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'email'    => [
                'sometimes',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($usuario->id),
            ],
            'password' => 'nullable|string|min:8',
            'role_id'  => 'sometimes|integer|exists:roles,id',
        ]);

        if (isset($validated['name'])) {
            $usuario->name = $validated['name'];
        }

        if (isset($validated['email'])) {
            $usuario->email = $validated['email'];
        }

        if (!empty($validated['password'])) {
            $usuario->password = Hash::make($validated['password']);
        }

        // Prevent self-demotion (an admin cannot change their own role to non-admin)
        if (isset($validated['role_id'])) {
            if ($request->user() && $request->user()->id === $usuario->id && (int)$validated['role_id'] !== 1) {
                // Ignore demotion request silently or continue, keeping 'admin'
            } else {
                $usuario->role_id = $validated['role_id'];
            }
        }

        $usuario->save();

        return response()->json($usuario);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, User $usuario): JsonResponse
    {
        // Prevent deleting the currently authenticated user
        if ($request->user() && $request->user()->id === $usuario->id) {
            return response()->json([
                'message' => 'Acción denegada: No puedes eliminar tu propia cuenta de usuario en esta sesión.'
            ], 400);
        }

        $usuario->delete();

        return response()->json([
            'message' => 'Usuario eliminado correctamente.'
        ]);
    }
}
