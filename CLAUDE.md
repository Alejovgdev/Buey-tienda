# Instrucciones del proyecto

## Base de datos (Supabase)

- **BD de pruebas:** `tienda-buey-dev` (ref `pwkpuvagoupvynamskmh`). Es la única base de datos a la que se accede.
- **Acceso:** por la CLI de Supabase con la contraseña de la variable de entorno `SUPABASE_DB_PASSWORD`, conectando con `--db-url` al pooler del proyecto (URL en `supabase/.temp/pooler-url`). **No usar `--linked`** (depende de un token de acceso que no se usa en este proyecto). La contraseña no se escribe en archivos ni se muestra en la salida.
- **Solo lectura, sin preguntar:** consultas `SELECT`, `supabase migration list`, cualquier comando con `--dry-run`.
- **Cambios en la BD, siempre con OK previo:** `db push`, `migration repair`, `INSERT`, `UPDATE`, `DELETE`, DDL o cualquier otra escritura. Antes de ejecutarlo, explicar qué hace y esperar la aprobación explícita.
- **Producción:** nunca usar ni pedir credenciales de producción.
