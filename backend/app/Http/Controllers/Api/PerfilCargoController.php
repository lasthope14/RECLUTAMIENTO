<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PerfilCargo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PerfilCargoController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PerfilCargo::withCount('postulaciones');

        if ($request->filled('activo')) {
            $query->where('activo', filter_var($request->activo, FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('search')) {
            $query->where('nombre', 'like', "%{$request->search}%");
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre'        => 'required|string|max:255',
            'area'          => 'nullable|string|max:255',
            'descripcion'   => 'nullable|string',
            'requisitos'    => 'nullable|array',
            'salario_rango' => 'nullable|string|max:100',
            'activo'        => 'boolean',
            'fecha_apertura'=> 'nullable|date',
            'fecha_cierre'  => 'nullable|date|after_or_equal:fecha_apertura',
        ]);

        $perfil = PerfilCargo::create($validated);
        return response()->json($perfil, 201);
    }

    public function show(PerfilCargo $perfilCargo): JsonResponse
    {
        $perfilCargo->load(['postulaciones' => fn($q) => $q->latest()->limit(10)]);
        $perfilCargo->loadCount('postulaciones');
        return response()->json($perfilCargo);
    }

    public function update(Request $request, PerfilCargo $perfilCargo): JsonResponse
    {
        $validated = $request->validate([
            'nombre'        => 'sometimes|string|max:255',
            'area'          => 'nullable|string|max:255',
            'descripcion'   => 'nullable|string',
            'requisitos'    => 'nullable|array',
            'salario_rango' => 'nullable|string|max:100',
            'activo'        => 'boolean',
            'fecha_apertura'=> 'nullable|date',
            'fecha_cierre'  => 'nullable|date',
        ]);

        $perfilCargo->update($validated);
        return response()->json($perfilCargo);
    }

    public function destroy(PerfilCargo $perfilCargo): JsonResponse
    {
        $perfilCargo->delete();
        return response()->json(['message' => 'Perfil eliminado correctamente']);
    }
}
