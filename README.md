# KDS tienda

PROMPT LOVABLE — KDS (KITCHEN DISPLAY SYSTEM) MVP

Yo Llevo la Tarta

CONTEXTO

"Yo Llevo la Tarta" es una tienda de postres personalizados en formato pequeño. Una sola persona trabaja en tienda. No hay mostrador tradicional ni interacción verbal con el cliente: los pedidos llegan desde un configurador digital (app/tablet del cliente) directamente a cocina. Cuando el pedido está listo, el número aparece en una pantalla y el cliente lo recoge solo.

QUÉ ES EL KDS

Una pantalla táctil en cocina que muestra los pedidos activos y permite al cocinero gestionarlos. Es la única interfaz que usa la persona de tienda durante el servicio. Tiene que ser extremadamente simple: en hora punta no hay tiempo para navegar por menús.

Hay dos tipos de pedido con lógicas distintas:

Pedidos en tienda: el cliente ha configurado su pedido en el local y espera allí

Pedidos para recoger: el cliente ha pedido desde su móvil y ha elegido una hora de recogida

ESCALABILIDAD A 2 ESTACIONES

El sistema está diseñado para que en el futuro haya 2 personas preparando pedidos, cada una con su propia pantalla KDS. Los pedidos se reparten aleatoriamente entre las dos estaciones. Cada cocinero solo ve y gestiona sus pedidos asignados. Para el MVP se construye con 1 estación pero la arquitectura tiene que permitir añadir una segunda sin rediseño.

DISEÑO DE PANTALLA — VISTA PRINCIPAL

La pantalla se divide en dos carriles visualmente diferenciados, siempre visibles a la vez:

CARRIL IZQUIERDO — PEDIDOS EN TIENDA

Fondo ligeramente más oscuro o con borde de color neutro

Título: "En tienda"

Los pedidos aparecen en orden de llegada, el más antiguo arriba

Cada pedido ocupa una tarjeta con:

Número de pedido (grande, muy visible)

Detalle del pedido: formato + crema + topping/s

Timer visual desde que llegó el pedido (cuenta hacia arriba)

Barra de progreso o indicador de tiempo óptimo: 30 segundos. Verde si está dentro del tiempo, amarillo si se acerca, rojo si se ha pasado

Botón grande "LISTO" — al pulsarlo el pedido desaparece del KDS y el número aparece en la pantalla de recogida

CARRIL DERECHO — PEDIDOS PARA RECOGER

Fondo ligeramente diferente o con borde de color de marca (rosa #F4A7B9)

Título: "Para recoger"

Los pedidos se ordenan por hora de recogida, el más próximo arriba

Cada pedido ocupa una tarjeta con:

Número de pedido

Hora de recogida elegida por el cliente (en formato HH:MM, intervalos de 15 min)

Tiempo restante hasta esa hora (cuenta atrás)

Detalle del pedido: formato + crema + topping/s

Botón "PREPARADO" — al pulsarlo el pedido se marca como en nevera y deja de generar alertas. La tarjeta cambia a estado "En nevera" con color apagado pero sigue visible hasta la hora de recogida

ALERTA DE FRANJA HORARIA (pedidos para recoger)

Cada 15 minutos, si hay pedidos cuya hora de recogida corresponde a esa franja, salta una alerta visual en pantalla

La alerta muestra: "Pedidos para las HH:MM" + listado de números de pedido de esa franja

Si no hay pedidos en esa franja: silencio total, sin ninguna notificación

PANTALLA DE RECOGIDA (pantalla separada, visible para el cliente)

Una segunda pantalla o ventana, pensada para estar en el mostrador o en un monitor visible desde la sala.

Fondo negro, número de pedido grande en blanco o rosa

Muestra los últimos pedidos marcados como listos

Formato simple: "Tu pedido está listo: #07 · #12 · #15"

Los números desaparecen después de 3 minutos o cuando el siguiente lote aparece

Sin texto adicional, sin nombre del cliente, sin detalles del pedido

DETALLE DE CADA TARJETA DE PEDIDO

Información que muestra cada tarjeta en el KDS:

#07  |  Tarta abierta pequeña
     |  Crema vainilla
     |  Ganache café
     |  ── ── ── ── ── ── [████████░░] 24s / 30s
     |                          [LISTO]


Para cake shake:

#08  |  Cake shake
     |  Crema coulant chocolate
     |  Ganache matcha + Crema de pistacho
     |  ── ── ── ── ── ── [██████████] 38s / 30s 🔴
     |                          [LISTO]


Para pedido de recogida:

#09  |  🕐 Recogida: 19:30  (en 12 min)
     |  Tarta en lata pequeña
     |  Crema NY cheesecake
     |  Mermelada de fresa
     |                      [PREPARADO]


FLUJO COMPLETO

Pedido en tienda:

Cliente configura en tablet → confirma pedido

Pedido aparece en carril izquierdo del KDS con número y timer

Cocinero prepara → pulsa LISTO

Pedido desaparece del KDS

Número aparece en pantalla de recogida

Cliente recoge

Pedido para recoger:

Cliente pide desde móvil → elige hora de recogida en intervalos de 15 min → paga

Pedido aparece en carril derecho del KDS con hora de recogida y cuenta atrás

Cuando llega la franja → alerta en pantalla

Cocinero prepara → pulsa PREPARADO → pedido pasa a estado "En nevera"

A la hora de recogida → número aparece en pantalla de recogida

Cliente recoge

UX Y COMPORTAMIENTO

Sin login para el MVP

Sin navegación: todo en una sola pantalla siempre visible

Diseñado para tablet horizontal en cocina

Tipografía grande — se lee desde lejos con las manos ocupadas

Toque mínimo: solo LISTO o PREPARADO

El timer del tiempo óptimo (30 segundos) es orientativo, no bloquea nada. Es solo un indicador visual para que el cocinero sepa si va bien de ritmo

Los pedidos en tienda no tienen cuenta atrás de hora, solo el timer desde que llegaron

Los pedidos para recoger no tienen timer de 30 segundos, solo la cuenta atrás hasta la hora de recogida

DATOS DE PRUEBA

Carga estos pedidos ficticios para que el KDS se vea funcional desde el primer momento:

Pedidos en tienda (carril izquierdo):

# Formato Crema Topping Llegó hace 07 Tarta abierta pequeña Vainilla Ganache café 18s 08 Cake shake Coulant chocolate Ganache matcha + Crema pistacho 45s 11 Tarta abierta pequeña Lemon curd Mermelada fresa 8s

Pedidos para recoger (carril derecho):

# Formato Crema Topping Hora recogida 09 Tarta en lata pequeña NY cheesecake Mermelada fresa 19:30 13 Tarta abierta pequeña Basque cheesecake Crema de nuez 19:45 14 Cake shake Vainilla Ganache frambuesa + Crema avellana 19:45

El pedido #09 debe aparecer en estado "En nevera" (ya preparado) para mostrar ese estado visual. La hora actual de prueba debe ser 19:22 para que las cuentas atrás tengan sentido.

VISUAL Y ESTILO

Fondo muy oscuro (casi negro) — es una pantalla en cocina con luz artificial

Texto blanco principal

Rosa #F4A7B9 para pedidos de recogida y detalles de marca

Rojo #E8341C para alertas y timer en rojo cuando se pasa del tiempo óptimo

Verde #4CAF50 para timer dentro del tiempo óptimo y estado OK

Amarillo #FFC107 para timer acercándose al límite

Números de pedido en tipografía muy grande y bold — son lo más importante

Botones LISTO y PREPARADO grandes, fáciles de pulsar con el dedo

Sin iconos decorativos, sin animaciones innecesarias

Logo "Yo Llevo la Tarta" pequeño en esquina superior, sin protagonismo

LO QUE NO ES ESTE MVP

No gestiona pagos

No tiene login ni usuarios

No se comunica con el dashboard de obrador (eso va en el desarrollo real)

No envía SMS ni notificaciones push al cliente (la pantalla de recogida lo sustituye)

No tiene gestión de incidencias ni cancelaciones

No tiene historial de pedidos

RESUMEN: LO QUE TIENE QUE FUNCIONAR

Dos carriles visibles a la vez: en tienda y para recoger

Timer de 30 segundos con semáforo de colores en pedidos en tienda

Cuenta atrás hasta hora de recogida en pedidos para recoger

Alerta cada 15 minutos si hay pedidos en esa franja

Botón LISTO → pedido desaparece del KDS → número aparece en pantalla de recogida

Botón PREPARADO → pedido pasa a estado "En nevera" visualmente apagado

Pantalla de recogida separada con números de pedido listos en grande

Datos de prueba cargados y visibles desde el primer momento

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/266b46eb-41d5-441b-b658-46ced06d894c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
