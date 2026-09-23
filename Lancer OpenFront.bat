@echo off
setlocal
title OpenFront - lancement du jeu
cd /d "%~dp0"

echo ============================================================
echo    OpenFront - lancement du jeu sur cet ordinateur
echo ============================================================
echo.

rem ------------------------------------------------------------------
rem  1. Trouver Node.js
rem     - d'abord dans le PATH (installation normale)
rem     - sinon dans un dossier "node" place a cote de ce fichier
rem       (version portable copiee avec le projet)
rem     - sinon a l'emplacement d'installation habituel
rem ------------------------------------------------------------------
where node >nul 2>nul
if not errorlevel 1 goto :node_trouve

if exist "%~dp0node\node.exe" (
  set "PATH=%~dp0node;%PATH%"
  goto :node_trouve
)

if exist "%ProgramFiles%\nodejs\node.exe" (
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  goto :node_trouve
)

echo [ARRET] Node.js n'est pas installe sur cet ordinateur.
echo.
echo   Le jeu n'est pas un .exe : c'est un programme qui a besoin de
echo   Node.js pour tourner. C'est gratuit et l'installation prend
echo   deux minutes.
echo.
echo   1. La page de telechargement va s'ouvrir.
echo   2. Prendre la version "LTS" pour Windows.
echo   3. Installer en laissant toutes les options par defaut.
echo   4. Relancer ce fichier.
echo.
start "" https://nodejs.org/fr/download
pause
exit /b 1

:node_trouve
for /f "tokens=1 delims=." %%v in ('node -v') do set "MAJEURE=%%v"
set "MAJEURE=%MAJEURE:v=%"

rem Le jeu utilise Vite 8, qui demande Node 20.19+ ou 22.12+.
rem Node 21 n'est pas une version supportee.
if %MAJEURE% LSS 20 goto :node_trop_vieux
if %MAJEURE% EQU 21 goto :node_trop_vieux
goto :node_ok

:node_trop_vieux
node -v
echo.
echo [ARRET] Cette version de Node.js est trop ancienne pour le jeu.
echo         Il faut Node 22 ou plus recent (version "LTS").
echo.
echo   La page de telechargement va s'ouvrir : installer la version LTS
echo   par dessus l'ancienne, puis relancer ce fichier.
echo.
start "" https://nodejs.org/fr/download
pause
exit /b 1

:node_ok
for /f "delims=" %%v in ('node -v') do echo   Node.js %%v : OK
echo.

rem ------------------------------------------------------------------
rem  2. Dependances. Si le dossier node_modules a ete copie avec le
rem     projet, il n'y a rien a faire. Sinon on les installe avec la
rem     commande recommandee par les auteurs du jeu (npm run inst,
rem     c'est-a-dire npm ci --ignore-scripts).
rem ------------------------------------------------------------------
if exist "node_modules\vite\package.json" goto :deps_ok

echo   Premiere fois sur cet ordinateur : installation des composants.
echo   Cela telecharge environ 250 Mo et prend quelques minutes.
echo   Une connexion internet est necessaire.
echo.
call npm run inst
if errorlevel 1 goto :echec_install
echo.

:deps_ok
echo   Composants : OK
echo.
echo ------------------------------------------------------------
echo   Le jeu demarre. Le navigateur s'ouvre tout seul sur
echo   http://localhost:9000
echo.
echo   Si Windows affiche une alerte de pare-feu, cliquer sur
echo   "Autoriser l'acces" : c'est le serveur du jeu, en local.
echo.
echo   GARDER CETTE FENETRE OUVERTE pendant la partie.
echo   Pour arreter le jeu : fermer cette fenetre.
echo ------------------------------------------------------------
echo.

call npm run dev

echo.
echo Le jeu s'est arrete.
pause
exit /b 0

:echec_install
echo.
echo [ARRET] L'installation des composants a echoue.
echo.
echo   Causes les plus frequentes :
echo     - pas de connexion internet ;
echo     - un antivirus qui bloque l'ecriture dans le dossier ;
echo     - le projet est dans un dossier synchronise (OneDrive, Google
echo       Drive) : le deplacer sur le disque, par exemple C:\Jeux\.
echo.
echo   Les lignes rouges au-dessus donnent la raison exacte.
echo.
pause
exit /b 1
