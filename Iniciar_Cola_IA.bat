@echo off
title Hidroobras AI Recruiter - Procesador de Cola IA
:init
cls
echo ======================================================================
echo             HIDROOBRAS AI RECRUITER - TRABAJADOR DE COLA IA
echo ======================================================================
echo.
echo   Este script mantiene activo el procesador de evaluaciones de IA.
echo   Manten esta ventana abierta mientras se realizan evaluaciones de CVs.
echo.
echo   [INFO] Escuchando base de datos para procesar nuevos analisis con Gemini...
echo ======================================================================
echo.

cd /d "%~dp0backend"
php artisan queue:work --tries=2 --timeout=90

echo.
echo ======================================================================
echo   [ALERTA] El procesador de cola se ha detenido. 
echo   Presiona cualquier tecla para volver a iniciarlo de inmediato.
echo ======================================================================
pause
goto :init
