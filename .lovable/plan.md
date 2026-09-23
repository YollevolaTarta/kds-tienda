# Corregir filtros reales y legibilidad del KDS

## Cambios
- Sustituir `recogida` por el valor real `recoger` en la alerta, la lista de nevera y la pantalla del cliente.
- Limitar las recogidas listas de cocina y de la pantalla del cliente al día actual.
- Aumentar claramente formato, receta/crema y toppings; usar contraste pleno.
- Separar visualmente cada tarta, manteniendo intactos colores, botones y estructura general.

## Comprobación
- Revisar con los seis pedidos reales que los contadores coinciden.
- Confirmar la alerta de menos de 15 minutos, el pack agrupado y el aviso de decoración sorpresa.
- Confirmar que la pantalla del cliente excluye envíos y recogidas de otros días.

## Detalles técnicos
- No se cambiarán tablas, funciones, campos ni datos.
- Los filtros usarán exclusivamente los valores reales indicados y el rango local de hoy ya calculado por el KDS.
