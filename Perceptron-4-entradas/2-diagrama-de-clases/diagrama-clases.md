# Diagrama de clases

Siete clases. En UML, `−` es privado, `+` público, lo subrayado es de clase (`static`) y lo
que va en cursiva es abstracto. Las tablas que no tienen comportamiento propio (el historial de
iteraciones, los intentos, las filas de la compuerta) no son clases: van dentro de la clase que
las usa, como atributos.

```mermaid
classDiagram
    direction TB

    class Interfaz {
        -base : BaseConocimiento
        -perceptron : Perceptron
        -neurona : Neurona
        +entrenar()
        +leerNumero(texto)$ float
    }

    class Perceptron {
        +LIMITE : int = 999$
        -base : BaseConocimiento
        -neurona : Neurona
        -factor : float
        -historial : iteración, pesos, θ, errores
        -intentos : pesos, θ, factor, aprendió
        +entrenar() bool
        -sortear()
        -entrenarIntento() bool
    }

    class BaseConocimiento {
        +TABLA : 16 filas X1, X2, X3, X4, Y$
        -filas : entradas, salida
        +numeroEntradas() int
        +nivelLogico(valor)$ int
        +fila(entradasLogicas) numero, entradas, salida
    }

    class Neurona {
        -pesos : float x4
        -theta : float
        -activacion : FuncionActivacion
        -umbral : FuncionActivacion
        +calcular(entradas) potencial, tanh, salida
        +ajustar(entradas, esperada, factor)
    }

    class FuncionActivacion {
        <<abstracta>>
        +aplicar(v)*
    }

    class TangenteHiperbolica {
        +aplicar(v) float
    }

    class EscalonBipolar {
        +aplicar(v) int
    }

    Interfaz *-- "1" BaseConocimiento
    Interfaz *-- "1" Perceptron
    Interfaz ..> Neurona : construye con los valores editados
    Perceptron --> "1" BaseConocimiento
    Perceptron *-- "1" Neurona
    Neurona *-- "2" FuncionActivacion
    FuncionActivacion <|-- TangenteHiperbolica
    FuncionActivacion <|-- EscalonBipolar
```

## Las relaciones

| Relación | Tipo | Qué significa |
|---|---|---|
| `Interfaz` ◆— `BaseConocimiento` | Composición | La interfaz crea la tabla y se la pasa al perceptrón |
| `Interfaz` ◆— `Perceptron` | Composición | La interfaz crea su perceptrón y es dueña de él |
| `Interfaz` ⇢ `Neurona` | Dependencia | Cuando se editan los valores finales, construye una neurona nueva con ellos |
| `Perceptron` → `BaseConocimiento` | Asociación | Usa la tabla para entrenar, sin ser su dueño |
| `Perceptron` ◆— `Neurona` | Composición | Sortea su neurona y la entrena |
| `Neurona` ◆— `FuncionActivacion` (×2) | Composición | Tiene la tangente hiperbólica y el escalón |
| `TangenteHiperbolica`, `EscalonBipolar` ◁— `FuncionActivacion` | Herencia | Las dos son funciones de activación |
