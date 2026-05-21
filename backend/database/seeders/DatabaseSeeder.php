<?php

namespace Database\Seeders;

use App\Models\PerfilCargo;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Usuarios HR
        User::firstOrCreate(['email' => 'admin@hidroobras.com.co'], [
            'name'     => 'Administrador RRHH',
            'password' => Hash::make('Hidroobras2024!'),
        ]);
        User::firstOrCreate(['email' => 'coordinadorsst@hidroobras.com.co'], [
            'name'     => 'Coordinador SST',
            'password' => Hash::make('Hidroobras2024!'),
        ]);
        User::firstOrCreate(['email' => 'alexforero@hidroobras.com.co'], [
            'name'     => 'Alex Forero',
            'password' => Hash::make('Hidroobras2024!'),
        ]);

        // Perfiles de cargo oficiales de Hidroobras (Exactamente 3 perfiles finales)
        $perfiles = [
            [
                'nombre'      => 'Ingeniero Residente',
                'area'        => 'Ingeniería / Operaciones de Obra',
                'descripcion' => 'Planificar, coordinar y supervisar en campo la ejecución técnica, administrativa y de seguridad de los proyectos de redes hidráulicas, sanitarias, de gas o contra incendio asignados en obra, asegurando el cumplimiento de planos, cronogramas, presupuestos y normas de calidad y SST.',
                'requisitos'  => [
                    'educacion_min'          => 'Profesional en Ingeniería Civil, Ingeniería Sanitaria o Ingeniería Mecánica, con Matrícula Profesional vigente.',
                    'experiencia_min_años'   => 2,
                    'habilidades_requeridas' => ['Supervisión de obras hidráulicas', 'Lectura de planos arquitectónicos e hidrosanitarios', 'Control financiero y rendimientos de obra', 'PMI/PMBOK básico', 'Control de APU y cantidades', 'Sistemas de extinción de incendios (NFPA básico)', 'Seguridad y Salud en el Trabajo (SST)', 'Manejo de AutoCAD y Office', 'Coordinación de personal'],
                    'certificaciones'        => ['Matrícula Profesional vigente (COPNIA)', 'Curso de 50 horas de SST (Deseable)', 'Curso de Trabajo Seguro en Alturas (Coordinador o Avanzado)'],
                    'tipo_contrato'          => 'Término Indefinido o por Obra/Labor',
                    'salario_rango'          => 'Entre 3.5 a 5 SMLV',
                ],
                'salario_rango' => 'Entre 3.5 a 5 SMLV',
                'activo' => true,
            ],
            [
                'nombre'      => 'Oficial o Ayudante de Plomería',
                'area'        => 'Operaciones / Instalaciones de Obra',
                'descripcion' => 'Ejecutar, instalar o brindar soporte operativo y asistencia directa en las labores de instalación, acople, soldadura y tendido de redes de tuberías hidrosanitarias, de gas e incendios en obra. Cubre desde labores básicas de ayudantía hasta la responsabilidad técnica de oficialía.',
                'requisitos'  => [
                    'educacion_min'          => 'Básica Primaria, Secundaria o Bachiller. Deseable cursos o certificación de competencias del SENA en plomería o instalaciones hidrosanitarias.',
                    'experiencia_min_años'   => 1,
                    'habilidades_requeridas' => ['Instalación de tuberías (PVC, CPVC, Cobre, Acero, Polipropileno)', 'Tendido y excavación de redes de fluidos', 'Soldadura, termofusión y roscado de tuberías', 'Uso y cuidado de herramientas de plomería manuales y eléctricas (ranuradoras, terrajas)', 'Lectura básica de planos hidrosanitarios', 'Orden y aseo en campo', 'Seguridad en obra'],
                    'certificaciones'        => ['Curso vigente de Trabajo Seguro en Alturas (Nivel Avanzado / Operativo)', 'Certificación de competencias del SENA en plomería (Deseable)'],
                    'tipo_contrato'          => 'Por Obra o Labor / Término Indefinido',
                    'salario_rango'          => 'Entre 1 a 2 SMLV (Según escala de Ayudante u Oficial)',
                ],
                'salario_rango' => 'Entre 1 a 2 SMLV',
                'activo' => true,
            ],
            [
                'nombre'      => 'SST (Seguridad y Salud en el Trabajo)',
                'area'        => 'Seguridad y Salud en el Trabajo',
                'descripcion' => 'Coordinar, ejecutar, supervisar y divulgar las actividades y directrices del Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) de la compañía tanto en obra como en oficina, previniendo riesgos, asegurando el cumplimiento legal (Resolución 0312, Decreto 1072) y fomentando el autocuidado y las buenas prácticas en campo.',
                'requisitos'  => [
                    'educacion_min'          => 'Profesional, Tecnólogo o Técnico en Seguridad y Salud en el Trabajo (SST) o Salud Ocupacional, con Licencia vigente.',
                    'experiencia_min_años'   => 1,
                    'habilidades_requeridas' => ['Legislación colombiana de SST (Resolución 0312, Decreto 1072)', 'Identificación de peligros y valoración/matriz de riesgos', 'Investigación de incidentes y accidentes de trabajo', 'Inspecciones de seguridad en obra', 'Manejo de EPP', 'Capacitaciones de seguridad', 'Coordinación de alturas', 'Señalización y prevención'],
                    'certificaciones'        => ['Licencia en SST vigente', 'Curso de 50 horas de SST vigente', 'Curso de Trabajo Seguro en Alturas (Avanzado o Coordinador, deseable)'],
                    'tipo_contrato'          => 'Término Indefinido o por Obra/Labor',
                    'salario_rango'          => 'Entre 1.5 a 2.5 SMLV',
                ],
                'salario_rango' => 'Entre 1.5 a 2.5 SMLV',
                'activo' => true,
            ],
        ];

        foreach ($perfiles as $perfil) {
            PerfilCargo::updateOrCreate(['nombre' => $perfil['nombre']], $perfil);
        }
    }
}
