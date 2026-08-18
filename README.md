# El Mundo de la Aspiradora — Agente Inteligente

Implementación de un **agente inteligente con medida de rendimiento** sobre el clásico
*mundo de la aspiradora*, convertido en un **entorno dinámico**: tres habitaciones (**A**, **B**
y **C**) más la cuadrícula **D** del muelle de carga, con el **plano sorteado en cada corrida**,
bloqueos temporales que van y vienen, y desorden que aparece **a rachas**. Para dar el trabajo por
terminado no basta con cumplir la meta: tiene que haber quedado **todo limpio**.

La simulación es gráfica y se ejecuta en el navegador.

## Cómo ejecutarlo

Abre **`index.html`** con doble clic (Chrome, Edge, Firefox o Safari) y pulsa **«Iniciar»**.
No hay que instalar ni compilar nada.

La pantalla es deliberadamente sencilla: **el escenario y un botón**. Cada vez que pulsas
«Iniciar» se sortea un escenario completamente nuevo y arranca. El mismo botón pasa a **«Pausar»**
mientras corre y a **«Iniciar otra»** cuando termina.

Encima de la aspiradora hay un **globo de diálogo** que va contando lo que está haciendo y por qué:

| Dice | Cuándo |
|---|---|
| *¡Sucio! Aspirando* | ha llegado a una cuadrícula sucia y la está limpiando |
| *Limpio, sigo buscando* | la cuadrícula donde está ya estaba limpia |
| *Poca batería, voy a cargar* | ha bajado del umbral y deja lo que sea para volver al muelle |
| *Todo limpio, voy a cargar* | no encuentra nada que hacer y aprovecha para repostar |
| *Cargando…* | está en el muelle llenando la batería |
| *¡Bloqueado por aquí!* | ha chocado contra una cuadrícula ocupada o una pared |
| *Bloqueado, espero* | espera a que se levante un bloqueo para poder comprobar esa habitación |
| *Todo limpio, vuelvo al muelle* | ha cumplido las dos condiciones y se retira |
| *¡Trabajo terminado!* | ha llegado al muelle y el programa finaliza |

No hay más controles a la vista. Los valores configurables que pide el enunciado siguen en el
documento —en un bloque oculto del que la simulación los lee— pero no se muestran: **cada arranque
los sortea todos**. Para volver a exponerlos basta con quitar el atributo `hidden` del bloque
`#detalles` en `index.html`.

## El mundo

El espacio cerrado se reparte en cuatro cuadrículas, y su disposición cambia en cada corrida:

```
        +-------+                          +-------+
        |   D   |                          |   D   |
        +-------+                          +-------+
+-------+-------+-------+          +-------+-------+-------+
|   C   |   A   |   B   |          |   B   |   C   |   A   |
+-------+-------+-------+          +-------+-------+-------+

        dos de los planos posibles — se sortea en cada corrida
```

El plano **no es una línea**: las tres habitaciones van en fila y el muelle se cuelga encima de
una de ellas, formando una **T** o una **L**. **A**, **B** y **C** son las habitaciones que hay que
mantener limpias. **D** es la cuadrícula del muelle: no es una habitación, ahí no se ensucia nada,
no puede bloquearse y no cuenta para el requisito de «todo limpio».

**El plano se sortea en cada corrida.** Se barajan las tres habitaciones — así que A, B y C no salen
siempre en ese orden de izquierda a derecha — y se sortea de cuál de ellas cuelga el muelle. Salen
las seis ordenaciones posibles y las tres posiciones del muelle, todas con la misma frecuencia.

Eso cambia el problema de verdad: **el agente no puede dar por sabido el plano** ni memorizar un
recorrido. Tiene que orientarse en el que le toque, y calcular sobre la marcha el camino más corto
al muelle. La configuración admite también un plano fijo —`A | B | C` con `D` encima de `B`—, útil
para estudiar un caso concreto con calma.

A la cuadrícula del muelle **solo se llega subiendo desde la habitación de la que cuelga**, así que
esa habitación es el paso obligado hacia la recarga: por eso nunca puede surgir un bloqueo nuevo
sobre ella. La aspiradora usa cuatro movimientos — `Izquierda`, `Derecha`, `Arriba` y `Abajo`.

La aspiradora **percibe** en qué cuadrícula está, si esa cuadrícula tiene suciedad y cuánta
batería le queda: la percepción `[localización, estado, batería]`. Puede **elegir** entre siete
acciones: `Izquierda`, `Derecha`, `Arriba`, `Abajo`, `Aspirar`, `Cargar` y `Nada`.

Todo el escenario se sortea al arrancar: **el plano**, la posición inicial, la suciedad, dónde cae
la cuadrícula ocupada y cuánto dura, y la meta de limpieza.

### El entorno es dinámico, y el desorden va a rachas

Limpiar una cuadrícula **no la deja limpia para siempre**. Aparece basura nueva mientras el agente
trabaja, así que tiene que seguir patrullando: es un entorno que cambia bajo sus pies, no un
problema que se resuelve una vez.

El ritmo **no es una cadencia fija**. Cada pocos pasos el mundo sortea una intensidad nueva, de
modo que hay rachas en las que cae basura casi seguida y calmas en las que no aparece nada en
mucho rato. El ajuste que eliges (poco / normal / mucho desorden) es solo la media alrededor de la
que oscila. Debajo del escenario se ve en todo momento si el mundo está en *racha*, *normal* o
*calma*.

### La cuadrícula ocupada, y que el bloqueo es temporal

Una de las cuadrículas puede quedar **ocupada** al azar (trama roja y un mueble). Bloquea el paso:
la aspiradora choca contra ella y no puede cruzarla.

**El bloqueo no está todo el tiempo.** Dura un número aleatorio de pasos —y cada mundo sortea su
propio rango, así que unas veces son bloqueos cortos y otras largos—, con la cuenta atrás a la
vista sobre la cuadrícula: `OCUPADA · 7`. Cuando se agota, la cuadrícula queda libre y la
aspiradora ya puede cruzar. Más adelante puede volver a surgir un bloqueo nuevo en otra
cuadrícula. Es como si alguien moviera un mueble de sitio de vez en cuando.

- Nunca aparece bajo la posición inicial de la aspiradora.
- En el modo *«Aleatoria — puede no haber ninguna»* hay una probabilidad de que **no exista
  ninguna** al empezar, de modo que también salen corridas con el mundo A–B–C libre.
- Mientras cae sobre la habitación del medio, deja **incomunicadas** las dos de los extremos: la
  aspiradora solo puede trabajar en el lado donde esté… hasta que el bloqueo se levante.
- **Que esté ocupada no significa que esté limpia.** Si había suciedad, ahí sigue; y mientras dura
  el bloqueo también se puede ensuciar más, como se ensucia el suelo debajo de un mueble. Lo único
  que impide el bloqueo es que la aspiradora entre a limpiarla.
- Un bloqueo nuevo **nunca deja el muelle inalcanzable** ni cae sobre la aspiradora: si pudiera, un
  simple azar del entorno la condenaría a morir de batería.

La configuración admite un modo *permanente*, en el que el bloqueo no se levanta nunca. Sirve para
estudiar el caso de las cuadrículas incomunicadas, y para ver el fallo que el bloqueo temporal
evita: si cae sobre la habitación que da paso al muelle, la aspiradora queda encerrada sin poder
recargar y acaba sin batería.

### El muelle de carga

Cada acción gasta batería (moverse 5, aspirar 9, chocar 1). Cuando la batería baja del umbral, la
aspiradora **deja lo que esté haciendo y vuelve al muelle** a recargar hasta llenarla, y luego
retoma el trabajo. El muelle está en la cuadrícula D, colgada de una habitación sorteada, y nunca
puede bloquearse — si no, no podría recargar nunca.

Si se quedara sin batería fuera del muelle, la simulación termina en fallo. Con los ajustes por
defecto no ocurre nunca, y hay una prueba automática que lo verifica.

### La meta, y el requisito de dejarlo todo limpio

Cada corrida sortea una **meta aleatoria** de unidades de suciedad, dentro de un rango que también
se sortea. Es la carga de trabajo de la sesión: mientras no se cumpla, el piso se sigue ensuciando.

Cumplir la meta **no basta para terminar**. Hacen falta las dos cosas a la vez:

1. haber aspirado las unidades de suciedad de la meta, y
2. que **A, B y C hayan quedado todas limpias**.

Cumplida la meta deja de aparecer desorden nuevo, y entonces el agente da su ronda final:
recorre las habitaciones, limpia lo que quede y solo cuando le constan las tres limpias vuelve
a D y se recoge. Sin esa pausa el requisito sería inalcanzable — con basura cayendo sin descanso
nunca existiría un instante en el que todo estuviera limpio, y la simulación no terminaría jamás.

Se puede pedir el modo sin pausa (`basuraTrasLaMeta: true` en la configuración) para ver
justamente eso: un entorno que no da tregua.

Lo interesante es **cómo sabe el agente que está todo limpio**. Solo percibe la cuadrícula en la
que está, así que no puede mirar el piso entero: tiene que haber visto limpia cada habitación
**con sus propios sensores** desde la última vez que encontró suciedad. Si encuentra basura en
cualquier parte, esa cuenta se reinicia y vuelve a empezar.

Y aquí está el matiz que lo hace honesto: **haber chocado contra una cuadrícula ocupada no cuenta
como haberla comprobado**. Que no pueda entrar no dice nada sobre si está sucia — de hecho puede
estarlo. Mientras siga bloqueada, el agente no puede afirmar que todo esté limpio, así que:

- **no se rinde mientras espera**: el contador de intentos sin encontrar suciedad se pausa si queda
  una habitación bloqueada por comprobar, porque eso no es «no encuentro nada», es «todavía no he
  podido mirar»;
- **vuelve a probar la puerta** cada tanto, porque los bloqueos son temporales y esa es la única
  forma que tiene de enterarse de que ya se levantó. Va alternando entre insistir y seguir
  patrullando, para no quedarse plantado.

## Valores configurables

Todos se sortean en cada arranque; ninguno se muestra en pantalla. Esta es la tabla de lo que el
motor acepta, para quien lea el código:

| Configuración | Opciones |
|---|---|
| **a) Localización inicial de la aspiradora** | Aleatoria (por defecto), A, B o C |
| **b) Suciedad inicial** | Aleatoria (por defecto), las tres, dos, una sola o ninguna |
| **c) Intentos sin encontrar suciedad para finalizar** | De 1 a 25; cada arranque sortea entre 12 y 22 |
| Distribución de las cuadrículas | Aleatoria (por defecto): se barajan A, B y C y se sortea de cuál cuelga el muelle. O fija: `A \| B \| C` con `D` encima de `B` |
| Cuadrícula ocupada | Aleatoria (puede no haber ninguna), aleatoria (siempre hay una), ninguna, o fija en A, B o C. Nunca sobre la que da paso al muelle |
| Duración del bloqueo | Temporal, con un rango de duración sorteado en cada mundo, o permanente |
| Ritmo al que aparece basura | Poco, normal o mucho desorden, o ninguno (entorno estático). Siempre por rachas |
| Meta de limpieza | Aleatoria dentro de un rango que también se sortea, o fija |
| Velocidad de la simulación | De 60 ms a 1400 ms por paso |

El bloque oculto conserva además los controles **Ejecutar este**, **Paso a paso** (avanza un solo
paso, para ver la decisión del agente en la tabla), **Nuevo mundo** y **Reiniciar**. La **barra
espaciadora** hace lo mismo que el botón y la **flecha derecha** avanza un paso.

Cada escenario tiene una **semilla** visible: con la misma semilla la corrida se repite exactamente
igual, incluida la basura que va apareciendo.

## La función del agente

```
función AGENTE-ASPIRADORA([localización, estado, batería]) devuelve una acción
  si hubo choque entonces anotar esa cuadrícula como ocupada

  si la batería está por debajo del umbral entonces
     si está en el muelle entonces devolver Cargar
     de otra forma, encaminarse al muelle por el camino más corto

  si estado = Sucio entonces
     olvidar lo que le constaba: ya no sabe que todo esté limpio
     devolver Aspirar

  anotar esta habitación como vista limpia

  si ya aspiró las unidades de su meta Y le constan limpias A, B y C entonces
     si está en el muelle entonces devolver Nada   (el programa finaliza)
     de otra forma, encaminarse al muelle

  si le constan limpias A, B y C Y le falta batería entonces
     encaminarse al muelle y ponerse a Cargar

  si se alcanzó el número de intentos sin suciedad entonces devolver Nada

  de otra forma, elegir a dónde ir:
     entre las salidas de esta cuadrícula, quedarse con las habitaciones que
     NO le constan limpias; si no queda ninguna, con las habitaciones sin más
     (el muelle no se patrulla); descartar deshacer el paso que acaba de dar
     y, entre las que empaten, elegir al azar
```

El núcleo sigue siendo la regla del enunciado: *si la cuadrícula en la que se encuentra está sucia,
entonces aspirar; de otra forma, cambiar de cuadrícula*.

Pero **«cambiar de cuadrícula» ya no es rebotar** de derecha a izquierda. El plano es una T y el
agente decide a dónde ir con criterio: va a por las habitaciones que **no le constan limpias**, que
son las únicas donde puede haber algo que aspirar; no patrulla el muelle, porque ahí nunca hay nada;
evita deshacer el paso que acaba de dar si le queda alternativa; y **entre las opciones que le
empatan elige al azar**, de modo que no recorre siempre el mismo circuito. Para volver a cargar
calcula el **camino más corto**, rodeando lo que sabe bloqueado — y si no hay forma de rodearlo, se
planta delante del obstáculo a esperar a que se levante en vez de rendirse.

Tiene además comportamientos automáticos que salen de ese razonamiento:

- si la batería baja del umbral, **deja lo que sea** y vuelve al muelle;
- si ve que **está todo limpio** y aún le falta batería, aprovecha para subir a repostar en lugar de
  dar vueltas en balde;
- si está todo limpio **y** ya cumplió su meta, se recoge en el muelle y termina.

Lo que la envuelve es lo que convierte al agente reactivo simple en un **agente basado en modelo**.
Un agente puramente reactivo no sirve en este entorno, porque su percepción `[localización, estado]`
no le dice dónde está el muelle ni cuánto lleva limpiado. El agente mantiene por eso un pequeño
**modelo interno del mundo**:

- **el plano de la casa**, para calcular a dónde le lleva cada movimiento y cuál es el camino más
  corto al muelle;
- **el plano que le ha tocado y dónde está el muelle**, para calcular el camino más corto de vuelta;
- **si está en mitad de una recarga**, para no salir corriendo con la batería a medias;
- **cuánta suciedad lleva aspirada**, para saber cuándo ha cumplido su meta;
- **qué habitaciones le constan limpias** y contra cuáles ha chocado, que es lo que le permite
  concluir que ya puede recogerse.

## Medida de rendimiento

> *Que las localizaciones queden limpias y después de esto el programa finalice.*

Se puntúa con **un punto por cada habitación que esté limpia en cada uno de los 90 pasos de tiempo
evaluados, menos 1 punto por cada movimiento**:

```
rendimiento = (cuadrículas limpias en cada paso de tiempo, sumadas sobre el horizonte)
            − (1 × movimientos)
```

En un entorno dinámico esta es la medida adecuada, y es más exigente de lo que parece: no premia
*haber limpiado* una vez, sino **mantener limpio** el espacio a lo largo del tiempo, que es lo que
de verdad se le pide a una aspiradora. Una que limpie y se pare mientras vuelve a ensuciarse todo
puntúa peor que una que siga patrullando.

El **horizonte de tiempo fijo** es la otra pieza importante. Si solo se contaran los pasos que el
agente decide dar, le convendría no parar nunca, porque cada paso extra sumaría puntos por las
cuadrículas ya limpias. Midiendo siempre sobre los mismos 90 pasos, el mundo se queda como quedó
cuando el agente se detuvo y sigue contando; así **dejar todo limpio y terminar cuanto antes** es lo
que más puntúa, que es justo lo que pide el enunciado.

Bajo el escenario se ven en todo momento las barras de **batería**, **avance de la meta** y
**requisito: todo limpio**, además del ritmo al que está apareciendo el desorden. El bloque oculto
guarda el resto de métricas —pasos, aspirados, movimientos, choques, recargas, basura aparecida y
bloqueos surgidos— y la tabla completa de **secuencia de percepciones → acción**.

## Estructura del proyecto

```
index.html          Interfaz y estructura de la página
css/estilos.css     Presentación del escenario y los paneles
js/mundo.js         Motor: el mundo, el agente y la medida de rendimiento
js/ui.js            Parte gráfica: dibuja el escenario y controla la simulación
pruebas/pruebas.js  Pruebas automáticas del motor
```

`js/mundo.js` no depende del navegador, así que la lógica del agente se puede probar por separado.

## Pruebas

```
node pruebas/pruebas.js
```

Comprueba 106 condiciones: la regla del agente, la gestión de batería y el regreso al muelle, que
la cuadrícula D nunca se ensucia ni se bloquea, que el plano sorteado siempre es coherente y sale con las seis ordenaciones
posibles, que el agente se orienta en cualquiera de ellos, que usa los cuatro movimientos y no tira siempre para el mismo lado ni deshace el paso que acaba de dar, que
sube a repostar por su cuenta al ver que está todo limpio, que el desorden aparece a intervalos
variados con rachas y calmas, que una cuadrícula ya limpiada puede volver a ensuciarse, que el bloqueo se libera
justo al agotarse su tiempo y que los bloqueos nuevos nunca aíslan el muelle, que una cuadrícula puede estar sucia y ocupada a la vez y que bloquearla no
hace desaparecer su suciedad, que chocar contra ella no la da por comprobada y que el agente espera
a que se libere el paso en vez de rendirse, que deduce correctamente cuándo está todo limpio (y que
nunca se recoge en falso creyéndolo sin estarlo), que
al terminar el trabajo está en D con las dos condiciones cumplidas, la coherencia de la medida de
rendimiento, que la misma semilla repite la corrida exactamente, y que ninguna combinación de
configuración se queda en un bucle infinito.

## Escenarios interesantes para probar

- **Mucho desorden.** Se ve bien el ciclo completo: rachas en las que no da abasto, viajes a D a
  recargar, y la ronda final tranquila cuando el desorden para al cumplirse la meta.
- **Cuadrícula ocupada en B, inicio en A.** La aspiradora queda encerrada en A y choca contra B
  hasta que el bloqueo se levanta; entonces cruza y sigue con el resto.
- **Plano fijo con bloqueo permanente en B.** Como a D solo se llega subiendo desde B, la
  aspiradora queda encerrada sin poder recargar nunca: acaba quedándose sin batería. Es el fallo que
  el bloqueo temporal evita, y se ve en unos 50 pasos.
- **Pulsa «Nuevo mundo» varias veces** sin ejecutar, solo para ver cómo cambia el plano: a veces
  sale una T, a veces una L, y el muelle cuelga de una habitación distinta cada vez.
- **Poco desorden y meta 12.** El criterio de intentos sin encontrar suciedad corta la corrida
  antes de que la meta llegue a cumplirse, aunque el piso quede limpio.
- **Ritmo «ninguno» y suciedad «ninguna».** El entorno vuelve a ser estático y el agente finaliza
  enseguida, como en el ejercicio original.
