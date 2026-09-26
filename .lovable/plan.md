# Corrección semántica de color

## Cambios
- Actualizar exclusivamente los tokens de color de `src/styles.css`: añadir las cuatro variantes canónicas de marca y estados, ajustar sus valores y eliminar `ok`/`warn`.
- Sustituir únicamente clases de color en `src/routes/index.tsx`, `src/routes/pantalla.tsx`, `src/components/StockTab.tsx` y `src/components/StockMP.tsx` según el uso: `-strong` sobre fondos claros, `-foreground` sobre rellenos y token base para bordes, barras y puntos.
- Separar el estado visual del aviso informativo “No hay pedidos en esa cola” del estado visual de errores reales, sin cambiar el texto, cuándo aparece ni las llamadas existentes.

## Comprobación
- Contabilizar cada sustitución de clase y buscar en todo `src/` nombres antiguos y usos de texto no canónicos.
- Confirmar que el proyecto compila y revisar sin sesión el login y `/pantalla`, incluyendo ausencia de desplazamiento horizontal.
- Comparar el alcance del cambio para confirmar que no se alteraron estructura, tamaños, espaciados, textos ni comportamiento.

## Detalles técnicos
- El tipo interno del mensaje del KDS distinguirá solo su origen (`info` o `error`) para escoger clases; la lógica y condiciones permanecen idénticas.
- No se tocarán la base de datos, consultas, realtime, RPC ni archivos fuera del alcance visual indicado.
