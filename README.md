# FutBot — Frontend

Aplicación web del proyecto FutBot, desarrollada con **React** y construida con **Vite**.

Este documento explica cómo preparar el entorno, instalar las dependencias y levantar la aplicación en modo desarrollo, tanto en **Windows** como en **Linux**.

---

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Instalación de Node.js y Git](#2-instalación-de-nodejs-y-git)
3. [Clonar el repositorio](#3-clonar-el-repositorio)
4. [Instalar las dependencias del proyecto](#4-instalar-las-dependencias-del-proyecto)
5. [Variables de entorno](#5-variables-de-entorno)
6. [Levantar la aplicación](#6-levantar-la-aplicación)
7. [Scripts disponibles](#7-scripts-disponibles)
8. [Estructura del proyecto](#8-estructura-del-proyecto)
9. [Problemas frecuentes](#9-problemas-frecuentes)

---

## 1. Requisitos previos

| Herramienta | Versión mínima | Para qué se usa |
|---|---|---|
| **Node.js** | 20.19 o 22.12 (se recomienda la última LTS) | Ejecutar Vite y las herramientas del proyecto |
| **npm** | La que viene incluida con Node.js | Instalar dependencias y correr los scripts |
| **Git** | Cualquier versión reciente | Clonar el repositorio y versionar cambios |

> Vite no funciona con versiones de Node.js anteriores a las indicadas. Si ya tenés Node instalado, verificá la versión antes de seguir (ver paso 2).

---

## 2. Instalación de Node.js y Git

### Windows

**Opción A — Instalador oficial (recomendada):**

1. Descargar el instalador **LTS** para Windows (`.msi`) desde [nodejs.org](https://nodejs.org).
2. Ejecutarlo dejando las opciones por defecto. El instalador incluye `npm` y lo agrega al `PATH`.
3. Cerrar y volver a abrir la terminal.

**Opción B — Con `winget`** (desde PowerShell):

```powershell
winget install OpenJS.NodeJS.LTS
```

**Git** (si no está instalado): descargarlo desde [git-scm.com](https://git-scm.com) o con:

```powershell
winget install Git.Git
```

### Linux

Se recomienda instalar Node.js con **nvm** (Node Version Manager), porque los paquetes de los repositorios de algunas distribuciones (por ejemplo, `apt install nodejs` en Ubuntu) suelen traer versiones demasiado viejas para Vite.

1. Instalar nvm siguiendo las instrucciones del [repositorio oficial de nvm](https://github.com/nvm-sh/nvm#installing-and-updating).
2. Cerrar y volver a abrir la terminal (o ejecutar `source ~/.bashrc`).
3. Instalar y activar la última versión LTS de Node.js:

```bash
nvm install --lts
nvm use --lts
```

**Git** (si no está instalado):

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install git

# Fedora
sudo dnf install git

# Arch
sudo pacman -S git
```

### Verificar la instalación (Windows y Linux)

```bash
node -v
npm -v
git --version
```

`node -v` debe mostrar una versión igual o mayor a `v20.19.0` (o `v22.12.0`).

---

## 3. Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd <nombre-del-repositorio>
```

---

## 4. Instalar las dependencias del proyecto

Dentro de la carpeta del proyecto, el comando es el mismo en Windows y en Linux:

```bash
npm ci
```

`npm ci` instala **exactamente** las versiones registradas en `package-lock.json`, así todo el equipo trabaja con las mismas dependencias.

Usar `npm install` en su lugar solo cuando se agrega, quita o actualiza una dependencia. En ese caso, el `package-lock.json` modificado **debe commitearse** junto con el `package.json`.

> La carpeta `node_modules/` se genera al instalar y **nunca** se sube al repositorio (ya está incluida en `.gitignore`).

---

## 5. Variables de entorno

La aplicación lee su configuración desde un archivo `.env` en la raíz del proyecto. Este archivo **no** se sube al repositorio; se usa `.env.example` como plantilla.

Crear el `.env` a partir de la plantilla:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**Linux:**

```bash
cp .env.example .env
```

Variables disponibles:

| Variable | Descripción | Valor por defecto en desarrollo |
|---|---|---|
| `VITE_API_BASE_URL` | URL base de la API REST del backend | `http://localhost:8000/api/v1` |
| `VITE_WS_BASE_URL` | URL base de los WebSockets del backend (eventos globales y partidos en vivo) | `ws://localhost:8000/ws/v1` |

> En Vite, solo las variables que empiezan con `VITE_` quedan disponibles en el código del frontend. Después de modificar el `.env`, hay que reiniciar el servidor de desarrollo.

---

## 6. Levantar la aplicación

Con las dependencias instaladas, iniciar el servidor de desarrollo (mismo comando en Windows y Linux):

```bash
npm run dev
```

Abrir en el navegador:

```
http://localhost:5173
```

El servidor recarga la página automáticamente al guardar cambios en el código. Para detenerlo, presionar `Ctrl + C` en la terminal.

> Para que las pantallas que consumen la API funcionen, el backend tiene que estar corriendo en la URL configurada en `VITE_API_BASE_URL`.

---

## 7. Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo en `http://localhost:5173` |
| `npm run build` | Genera la versión optimizada para producción en la carpeta `dist/` |
| `npm run preview` | Sirve localmente el contenido de `dist/` para probar el build de producción |
| `npm run lint` | Analiza el código con ESLint y reporta errores de estilo o posibles bugs |

---

## 8. Estructura del proyecto

```
├── public/              # Archivos estáticos servidos tal cual (favicon, imágenes)
├── src/
│   ├── assets/          # Imágenes y recursos importados desde el código
│   ├── components/      # Componentes reutilizables (botones, formularios, tarjetas, TacticalSetup, etc.)
│   ├── context/         # Estado global de la app (por ejemplo, la sesión del usuario)
│   ├── hooks/           # Custom hooks de React reutilizables
│   ├── pages/           # Vistas completas asociadas a una ruta (login, equipo, ligas, amistosos, partido)
│   ├── services/        # Comunicación con el backend: cliente HTTP (createHttpService) y WebSockets
│   ├── App.jsx          # Componente principal de la aplicación
│   ├── main.jsx         # Punto de entrada: monta la app de React en el HTML
│   └── index.css        # Estilos globales
├── .env.example         # Plantilla de variables de entorno (sí se versiona)
├── .env                 # Variables de entorno locales (NO se versiona)
├── .gitignore
├── eslint.config.js     # Configuración de ESLint
├── index.html           # HTML de entrada que usa Vite
├── package.json         # Dependencias y scripts
├── package-lock.json    # Versiones exactas de las dependencias
└── vite.config.js       # Configuración de Vite
```

> Algunas carpetas todavía están vacías y contienen un archivo `.gitkeep`, que solo sirve para que Git las versione. Se puede borrar cuando la carpeta tenga su primer archivo real.

---

