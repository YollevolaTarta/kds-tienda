# Stock en gramos y control de agotados

## Cambios
- Sustituir en Stock todos los campos y textos de kilos por gramos enteros, con miles separados por punto.
- Validar que los gramos recibidos no contengan coma ni punto y enviar `p_recibidos_g` al confirmar.
- Leer `v_tienda_avisos_stock` junto al stock y los envíos.
- Añadir, al principio de Stock, las filas bajo mínimos con acciones `MARCAR AGOTADO` y `Ya hay` mediante sus funciones existentes.
- Mostrar junto a la pestaña Stock el número de avisos aún no confirmados, sin alarma ni parpadeo.

## Comprobación
- Confirmar que no quedan nombres `kg_` ni el parámetro antiguo en Stock.
- Confirmar que el proyecto compila y que `/pantalla` sigue abriendo sin login.
- No modificar datos, tablas, vistas, funciones ni permisos; las acciones que cambian agotados no se pulsarán durante la prueba.

## Detalles técnicos
- El contador de cabecera leerá la misma vista ya filtrada por sesión y se actualizará en tiempo real junto con Stock.
- Los campos editables conservarán el formato visual `1.250`, pero se convertirán a enteros antes de llamar a la función.
