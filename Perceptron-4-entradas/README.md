# Perceptrón de 4 entradas — Compuerta lógica

Proyecto de redes neuronales: una neurona artificial que aprende, con el algoritmo del
perceptrón simple, una compuerta lógica de cuatro entradas.

## Contenido

```
Perceptron-4-entradas/
├── README.md                    este archivo
├── 1-aplicacion/                el programa
│   ├── index.html               ← se abre con doble clic
│   ├── css/estilos.css
│   └── js/
│       ├── perceptron.js        el modelo: la neurona y su entrenamiento
│       └── interfaz.js          la pantalla
├── 2-diagrama-de-clases/
│   ├── diagrama-clases.png      el diagrama, para verlo o imprimirlo
│   ├── diagrama-clases.svg      el mismo, ampliable sin perder calidad
│   └── diagrama-clases.md       su fuente, con la tabla de relaciones
├── 3-pruebas/
│   └── pruebas.js               25 comprobaciones (opcional, se corre con Node)
└── 4-informe/
    └── Informe-Perceptron-4-entradas.docx   el informe en normas APA
```

## Cómo abrirlo

Doble clic en **`1-aplicacion/index.html`**. No hay que instalar nada. Cada vez que se pulsa
**«Sortear valores y entrenar»** se sortea todo de nuevo y se vuelve a entrenar.

## La compuerta

La salida es **+1 sólo cuando X₁ vale 1 y además vale 1 alguna de X₂, X₃ o X₄**. En las otras
combinaciones es −1.

| X₁ | X₂ | X₃ | X₄ | Y | | X₁ | X₂ | X₃ | X₄ | Y |
|---|---|---|---|---|---|---|---|---|---|---|
| −1 | −1 | −1 | −1 | −1 | | 1 | −1 | −1 | −1 | −1 |
| −1 | −1 | −1 | 1 | −1 | | 1 | −1 | −1 | 1 | **1** |
| −1 | −1 | 1 | −1 | −1 | | 1 | −1 | 1 | −1 | **1** |
| −1 | −1 | 1 | 1 | −1 | | 1 | −1 | 1 | 1 | **1** |
| −1 | 1 | −1 | −1 | −1 | | 1 | 1 | −1 | −1 | **1** |
| −1 | 1 | −1 | 1 | −1 | | 1 | 1 | −1 | 1 | **1** |
| −1 | 1 | 1 | −1 | −1 | | 1 | 1 | 1 | −1 | **1** |
| −1 | 1 | 1 | 1 | −1 | | 1 | 1 | 1 | 1 | **1** |

La tabla del enunciado trae 19 filas, pero tres están repetidas (las filas 7, 8 y 9 son copia
de la 4, la 5 y la 6). Con cuatro entradas sólo hay 2⁴ = 16 combinaciones distintas, y son
éstas. Las repetidas piden la misma salida, así que no cambian lo que aprende la neurona.

## El método

```
Y = Tanh( X1·ω1 + X2·ω2 + X3·ω3 + X4·ω4 − θ )        salida = +1 si Y ≥ 0,  −1 si Y < 0
```

Cuando una fila falla se corrigen los pesos y el umbral (E es el factor de aprendizaje e Y la
salida esperada):

```
ωi = ωi + 2·E·Y·Xi          θ = θ + 2·E·Y·(−1)
```

Una **iteración** revisa las 16 filas con los mismos pesos y después corrige las que fallaron.
El entrenamiento termina cuando una iteración sale sin errores. Si llega a **999 iteraciones**
sin conseguirlo, el intento se cancela y se sortean valores nuevos.

## La programación orientada a objetos

Siete clases, cada una con una sola responsabilidad, y ninguna función suelta:

| Clase | Qué hace |
|---|---|
| `FuncionActivacion` | Clase abstracta: toda función de activación sabe `aplicar()` |
| `TangenteHiperbolica`, `EscalonBipolar` | Las dos funciones del método, hijas de la anterior |
| `BaseConocimiento` | La tabla de la compuerta, y cómo cuenta un valor real (por su signo) |
| `Neurona` | Calcula la salida y se corrige cuando falla |
| `Perceptron` | Sortea los valores y entrena la neurona, con el límite de 999 |
| `Interfaz` | Dibuja los resultados y lee las cajas de texto |

Las tablas que no tienen comportamiento propio (el historial de iteraciones, la lista de
intentos, las filas de la compuerta) no son clases: van como atributos dentro de la clase que
las usa.

Los cuatro pilares, y cómo se aplican en JavaScript:

- **Encapsulamiento.** Todos los atributos son privados con `#` (por ejemplo `#pesos`), que en
  JavaScript es privacidad real: intentar leer `neurona.#pesos` desde fuera de la clase es un
  error. Los pesos sólo cambian con `ajustar()`, y al pedirlos se entrega una copia.
- **Abstracción.** JavaScript no tiene la palabra `abstract`, así que `FuncionActivacion` lo
  impone en su constructor: si se intenta crear directamente, lanza un error.
- **Herencia.** `TangenteHiperbolica` y `EscalonBipolar` heredan de ella con `extends`.
- **Polimorfismo.** La neurona llama a `aplicar()` sin saber cuál de las dos tiene delante.

Una nota sobre los ficheros: el programa se carga con etiquetas `<script>` normales y no como
módulos de JavaScript, porque los navegadores bloquean los módulos cuando la página se abre con
doble clic. Por eso las clases de `perceptron.js` están disponibles en `interfaz.js` sin
`import`.

## Valores reales, sin redondear

Las cajas de texto **no tienen límite de caracteres** y aceptan coma, punto y notación
científica: `0,0000000000001`, `0.0000000000001` y `1e-13` valen lo mismo. Nada se redondea al
sortear, al leer ni al calcular.

Incluso un número de cientos de cifras se lee bien. Los números de JavaScript no caben por debajo
de unos 10⁻³²⁴ ni por encima de unos 10³⁰⁸, así que un valor con cuatrocientos ceros se quedaría en
cero, y uno de cuatrocientas cifras, en infinito. Como a la compuerta sólo le importa el signo, en
esos casos se conserva el signo que se escribió.

Como es una compuerta lógica, cada valor real cuenta por su signo: **positivo es 1, y cero o
negativo es −1**. Como el número se lee completo, `0,0000000000001` es positivo y cuenta como
**1**. Si se aproximara a cero, contaría como −1 y la neurona respondería otra fila de la tabla.

Por ejemplo, con `X₁ = 0,0000000000001`, `X₂ = 0,85`, `X₃ = −0,0000003` y `X₄ = 2,7`:

| | X₁ | X₂ | X₃ | X₄ | Fila | Y |
|---|---|---|---|---|---|---|
| Valor escrito | 0,0000000000001 | 0,85 | −0,0000003 | 2,7 | | |
| Valor lógico | 1 | 1 | −1 | 1 | Y14 | **1** |
| Si X₁ se aproximara a 0 | −1 | 1 | −1 | 1 | Y6 | −1 |

La pantalla enseña las dos cosas: el valor tal como se escribió y el valor lógico que le
corresponde, la fila de la tabla y la salida de la neurona comparada con la esperada.

La única tabla recortada es la de iteraciones, a 4 decimales, porque puede tener hasta 999
filas. Los valores exactos están en los apartados 1 y 3.

## Pruebas

Opcional, hace falta Node:

```sh
node 3-pruebas/pruebas.js
```

25 comprobaciones: la tabla de la compuerta, que los atributos son privados, la herencia, las
fórmulas, que `0,0000000000001` se lee entero y cuenta como 1, que un número de cientos de
cifras conserva su signo, 300 entrenamientos seguidos que
tienen que acabar todos acertando las 16 filas, y 5 000 combinaciones de valores reales al azar
que tienen que dar siempre la salida de su fila.
