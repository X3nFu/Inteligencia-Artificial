/*
 * perceptron.js — El modelo: la neurona y su entrenamiento.
 *
 * Cinco clases, cada una con una sola responsabilidad:
 *   FuncionActivacion   (abstracta) y sus hijas TangenteHiperbolica y EscalonBipolar
 *   BaseConocimiento    la tabla de la compuerta
 *   Neurona             calcula la salida y se corrige
 *   Perceptron          sortea los valores y entrena la neurona
 *
 * Todos los atributos son privados (#): solo se leen o se cambian a traves
 * de los metodos de su clase. Ningun valor se redondea.
 *
 * Metodo:   Y = Tanh( SUM(xi * wi) - theta )      salida = +1 si Y >= 0, si no -1
 * Ajuste:   wi = wi + 2*E*Y*xi                    theta = theta + 2*E*Y*(-1)
 */
'use strict';

/* ------------------------------------------------------------------ */
/* Funciones de activacion                                             */
/* ------------------------------------------------------------------ */

/*
 * Clase abstracta. JavaScript no tiene la palabra "abstract", asi que se
 * impide crearla directamente comprobando new.target.
 */
class FuncionActivacion {
  constructor() {
    if (new.target === FuncionActivacion) {
      throw new Error('FuncionActivacion es abstracta: usa una de sus hijas');
    }
  }

  aplicar() {
    throw new Error('Cada funcion de activacion tiene que definir aplicar()');
  }
}

class TangenteHiperbolica extends FuncionActivacion {
  aplicar(v) {
    return Math.tanh(v);
  }
}

class EscalonBipolar extends FuncionActivacion {
  aplicar(v) {
    return v >= 0 ? 1 : -1;
  }
}

/* ------------------------------------------------------------------ */
/* BaseConocimiento — la tabla de la compuerta                         */
/* ------------------------------------------------------------------ */

class BaseConocimiento {
  /*
   * Las 16 combinaciones de la compuerta del proyecto: [X1, X2, X3, X4, Y].
   * La salida es +1 solo cuando X1 = 1 y ademas vale 1 alguna de X2, X3, X4.
   */
  static TABLA = Object.freeze([
    [-1, -1, -1, -1, -1], [-1, -1, -1,  1, -1], [-1, -1,  1, -1, -1], [-1, -1,  1,  1, -1],
    [-1,  1, -1, -1, -1], [-1,  1, -1,  1, -1], [-1,  1,  1, -1, -1], [-1,  1,  1,  1, -1],
    [ 1, -1, -1, -1, -1], [ 1, -1, -1,  1,  1], [ 1, -1,  1, -1,  1], [ 1, -1,  1,  1,  1],
    [ 1,  1, -1, -1,  1], [ 1,  1, -1,  1,  1], [ 1,  1,  1, -1,  1], [ 1,  1,  1,  1,  1]
  ]);

  #filas;

  constructor(tabla = BaseConocimiento.TABLA) {
    this.#filas = tabla.map((fila) => ({ entradas: fila.slice(0, -1), salida: fila[fila.length - 1] }));
  }

  /* Una copia de las filas: desde fuera no se puede cambiar la tabla. */
  get filas() {
    return this.#filas.map((f) => ({ entradas: f.entradas.slice(), salida: f.salida }));
  }

  get numeroEntradas() {
    return this.#filas[0].entradas.length;
  }

  /*
   * Como es una compuerta logica, un valor real cuenta por su signo: positivo
   * es 1; cero o negativo es -1. El valor se lee completo, sin aproximarlo, asi
   * que 0,0000000000001 es positivo y cuenta como 1 (si se aproximara a cero,
   * contaria como -1).
   */
  static nivelLogico(valor) {
    return valor > 0 ? 1 : -1;
  }

  /* La fila de la tabla que corresponde a unas entradas logicas (+1 / -1). */
  fila(entradasLogicas) {
    const i = this.#filas.findIndex((f) => f.entradas.every((x, k) => x === entradasLogicas[k]));
    return { numero: i + 1, entradas: this.#filas[i].entradas.slice(), salida: this.#filas[i].salida };
  }
}

/* ------------------------------------------------------------------ */
/* Neurona                                                             */
/* ------------------------------------------------------------------ */

class Neurona {
  #pesos;
  #theta;
  #activacion = new TangenteHiperbolica();
  #umbral = new EscalonBipolar();

  constructor(pesos, theta) {
    this.#pesos = pesos.slice();
    this.#theta = theta;
  }

  get pesos() {
    return this.#pesos.slice();
  }

  get theta() {
    return this.#theta;
  }

  /*
   * Y = Tanh( SUM(xi * wi) - theta ) y la salida discreta. La neurona no sabe
   * que funcion concreta tiene en #activacion y en #umbral: solo les pide
   * aplicar() (polimorfismo).
   */
  calcular(entradas) {
    const potencial = entradas.reduce((suma, x, i) => suma + x * this.#pesos[i], 0) - this.#theta;
    const tanh = this.#activacion.aplicar(potencial);
    return { potencial, tanh, salida: this.#umbral.aplicar(tanh) };
  }

  /* La correccion del enunciado. El umbral se corrige como un peso cuya entrada vale -1. */
  ajustar(entradas, esperada, factor) {
    const paso = 2 * factor * esperada;
    this.#pesos = this.#pesos.map((w, i) => w + paso * entradas[i]);
    this.#theta = this.#theta + paso * (-1);
  }
}

/* ------------------------------------------------------------------ */
/* Perceptron — sortea los valores y entrena la neurona                */
/* ------------------------------------------------------------------ */

class Perceptron {
  static LIMITE = 999;           // iteraciones como mucho por intento
  static MAX_INTENTOS = 25;

  #base;
  #neurona = null;
  #factor = 0;
  #historial = [];               // una fila por iteracion: { iteracion, pesos, theta, errores }
  #intentos = [];                // uno por intento: { numero, pesos, theta, factor, iteraciones, aprendio }

  constructor(base) {
    this.#base = base;
  }

  get neurona() { return this.#neurona; }
  get historial() { return this.#historial.map((h) => ({ ...h, pesos: h.pesos.slice() })); }
  get intentos() { return this.#intentos.map((i) => ({ ...i, pesos: i.pesos.slice() })); }
  get aprendio() { return this.#intentos.some((i) => i.aprendio); }

  /*
   * Sortea pesos, umbral y factor de aprendizaje y entrena. Si el intento
   * llega a 999 iteraciones sin aprender, se cancela y se sortea todo de nuevo.
   */
  entrenar() {
    this.#intentos = [];
    for (let numero = 1; numero <= Perceptron.MAX_INTENTOS; numero++) {
      this.#sortear();
      const inicio = { pesos: this.#neurona.pesos, theta: this.#neurona.theta };
      const aprendio = this.#entrenarIntento();
      this.#intentos.push({ numero, ...inicio, factor: this.#factor,
                            iteraciones: this.#historial.length, aprendio });
      if (aprendio) return true;
    }
    return false;
  }

  /* Valores al azar, sin redondear: pesos y umbral entre -9 y 9, y el factor
     entre 0.0001 y 1 en escala logaritmica (como se busca un learning rate). */
  #sortear() {
    const azar = (min, max) => min + Math.random() * (max - min);
    const pesos = Array.from({ length: this.#base.numeroEntradas }, () => azar(-9, 9));
    this.#neurona = new Neurona(pesos, azar(-9, 9));
    this.#factor = Math.pow(10, azar(-4, 0));
  }

  /* Cada iteracion revisa todas las filas con los mismos pesos y despues
     corrige las que fallaron. Termina cuando una iteracion sale sin errores. */
  #entrenarIntento() {
    this.#historial = [];
    const filas = this.#base.filas;
    while (this.#historial.length < Perceptron.LIMITE) {
      const fallidas = filas.filter((f) => this.#neurona.calcular(f.entradas).salida !== f.salida);
      this.#historial.push({ iteracion: this.#historial.length + 1, pesos: this.#neurona.pesos,
                             theta: this.#neurona.theta, errores: fallidas.length });
      if (fallidas.length === 0) return true;
      fallidas.forEach((f) => this.#neurona.ajustar(f.entradas, f.salida, this.#factor));
    }
    return false;
  }
}

/* Para las pruebas con Node; en el navegador las clases ya estan disponibles. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FuncionActivacion, TangenteHiperbolica, EscalonBipolar,
                     BaseConocimiento, Neurona, Perceptron };
}
