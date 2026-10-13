/*
 * interfaz.js — La pantalla.
 *
 * Una sola clase, Interfaz, que dibuja los resultados del Perceptron y lee
 * las cajas de texto. No calcula nada por su cuenta: todo el calculo esta en
 * perceptron.js.
 */
'use strict';

class Interfaz {
  #base = new BaseConocimiento();
  #perceptron = new Perceptron(this.#base);
  #neurona = null;          // la que se esta mostrando: la entrenada o la editada a mano
  #cajasPesos;
  #cajasEntradas;
  #el;

  constructor() {
    const $ = (id) => document.getElementById(id);
    this.#el = {
      estado: $('estado'), valoresIniciales: $('valoresIniciales'), intentos: $('intentos'),
      tablaIteraciones: $('tablaIteraciones'), avisoPesos: $('avisoPesos'),
      tablaComprobacion: $('tablaComprobacion'), resumenComprobacion: $('resumenComprobacion'),
      avisoEntradas: $('avisoEntradas'), tablaPrueba: $('tablaPrueba'),
      resultadoPrueba: $('resultadoPrueba')
    };
    this.#cajasPesos = ['ω₁', 'ω₂', 'ω₃', 'ω₄', 'θ']
      .map((nombre) => this.#crearCaja($('camposPesos'), nombre, () => this.#leerPesos()));
    this.#cajasEntradas = ['X₁', 'X₂', 'X₃', 'X₄']
      .map((nombre) => this.#crearCaja($('camposEntradas'), nombre, () => this.#probar()));

    $('btnEntrenar').addEventListener('click', () => this.entrenar());
    $('btnRestaurar').addEventListener('click', () => this.#cargarPesosEntrenados());
    $('btnAzar').addEventListener('click', () => this.#entradasAlAzar());

    this.#entradasAlAzar();
    this.entrenar();
  }

  /* Sortea valores nuevos, entrena y lo muestra todo. */
  entrenar() {
    const aprendio = this.#perceptron.entrenar();
    const intentos = this.#perceptron.intentos;
    const cancelados = intentos.filter((i) => !i.aprendio).length;
    this.#el.estado.textContent = aprendio
      ? 'Aprendió en ' + this.#perceptron.historial.length + ' iteraciones' +
        (cancelados ? ', después de ' + cancelados + ' intento(s) cancelado(s).' : '.')
      : 'No logró aprender en ' + intentos.length + ' intentos.';

    this.#mostrarValoresIniciales(intentos[intentos.length - 1]);
    this.#mostrarEntrenamiento(intentos);
    this.#cargarPesosEntrenados();
  }

  /* ---------------------------------------------------------------- */
  /* Numeros: leerlos sin limite ni redondeo, y escribirlos            */
  /* ---------------------------------------------------------------- */

  /*
   * Convierte el texto de una caja en numero, sin limite de caracteres y sin
   * redondear. Acepta coma o punto y notacion cientifica: "0,0000000000001",
   * "-2.5", "1e-13". Devuelve null si no es un numero.
   */
  static leerNumero(texto) {
    const limpio = String(texto).trim().replace(',', '.').replace('−', '-');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(limpio)) return null;
    const valor = Number(limpio);
    const negativo = limpio.startsWith('-');

    // Los numeros de JavaScript no caben por debajo de unos 1e-324 ni por encima
    // de unos 1e308: un numero con cientos de cifras se quedaria en 0 o en
    // infinito. Como a la compuerta solo le importa el signo, se conserva el
    // signo que se escribio.
    const cifras = limpio.split(/[eE]/)[0];
    if (valor === 0 && /[1-9]/.test(cifras)) return negativo ? -Number.MIN_VALUE : Number.MIN_VALUE;
    if (!Number.isFinite(valor)) return negativo ? -Number.MAX_VALUE : Number.MAX_VALUE;
    return valor;
  }

  /* Para la tabla de iteraciones: 4 decimales, y nunca un cero falso. */
  static corto(v) {
    if (v !== 0 && Math.abs(v) < 0.00005) return v.toExponential(3);
    const texto = v.toFixed(4);
    return texto === '-0.0000' ? '0.0000' : texto;
  }

  static signo(v) {
    return v > 0 ? '+1' : '−1';
  }

  /* ---------------------------------------------------------------- */
  /* Apartados 1 y 2: valores iniciales y entrenamiento                */
  /* ---------------------------------------------------------------- */

  #mostrarValoresIniciales(intento) {
    const datos = intento.pesos.map((w, i) => ['ω' + (i + 1), w])
      .concat([['θ (umbral)', intento.theta], ['E (factor de aprendizaje)', intento.factor]]);
    this.#el.valoresIniciales.replaceChildren(...datos.map(([nombre, valor]) => {
      const caja = document.createElement('div');
      caja.className = 'valor';
      caja.append(Object.assign(document.createElement('span'), { textContent: nombre }),
                  Object.assign(document.createElement('b'), { textContent: String(valor) }));
      return caja;
    }));
  }

  #mostrarEntrenamiento(intentos) {
    this.#el.intentos.replaceChildren(...intentos.map((i) => Object.assign(
      document.createElement('li'), {
        className: i.aprendio ? 'bien' : 'mal',
        textContent: 'Intento ' + i.numero + ': ' + (i.aprendio
          ? 'aprendió en ' + i.iteraciones + ' iteraciones.'
          : 'se pasó de las ' + Perceptron.LIMITE +
            ' iteraciones, se cancela y se sortean valores nuevos.') +
          '  (E = ' + Interfaz.corto(i.factor) + ')'
      })));

    const historial = this.#perceptron.historial;
    this.#el.tablaIteraciones.replaceChildren(...historial.map((h, k) => {
      const fila = this.#fila([String(h.iteracion), ...h.pesos.map(Interfaz.corto),
                               Interfaz.corto(h.theta), String(h.errores)]);
      if (k === historial.length - 1 && h.errores === 0) fila.className = 'final';
      return fila;
    }));
  }

  /* ---------------------------------------------------------------- */
  /* Apartado 3: valores finales editables y comprobacion              */
  /* ---------------------------------------------------------------- */

  /* Pone en las cajas los valores exactos que aprendio la neurona. */
  #cargarPesosEntrenados() {
    const neurona = this.#perceptron.neurona;
    neurona.pesos.concat(neurona.theta)
      .forEach((v, i) => { this.#cajasPesos[i].value = String(v); });
    this.#leerPesos();
  }

  /* Lee las cajas y construye una neurona con esos valores. */
  #leerPesos() {
    const valores = this.#leerCajas(this.#cajasPesos, this.#el.avisoPesos);
    if (!valores) return;
    this.#neurona = new Neurona(valores.slice(0, 4), valores[4]);
    this.#comprobar();
    this.#probar();
  }

  #comprobar() {
    const filas = this.#base.filas;
    let aciertos = 0;
    this.#el.tablaComprobacion.replaceChildren(...filas.map((f, i) => {
      const obtenida = this.#neurona.calcular(f.entradas).salida;
      const bien = obtenida === f.salida;
      if (bien) aciertos++;
      const fila = this.#fila(['Y' + (i + 1), ...f.entradas.map(Interfaz.signo),
                               Interfaz.signo(f.salida), Interfaz.signo(obtenida), bien ? '✓' : '✗']);
      fila.lastChild.className = bien ? 'si' : 'no';
      return fila;
    }));
    this.#el.resumenComprobacion.textContent = 'Acierta ' + aciertos + ' de ' + filas.length + ' filas.';
  }

  /* ---------------------------------------------------------------- */
  /* Apartado 4: probar con valores reales                             */
  /* ---------------------------------------------------------------- */

  /*
   * Valores reales al azar, positivos y negativos y de tamaños muy distintos,
   * escritos como los escribiria una persona: de 0,0000000000001 a 0,99.
   */
  #entradasAlAzar() {
    this.#cajasEntradas.forEach((caja) => {
      const signo = Math.random() < 0.5 ? '-' : '';
      const ceros = '0'.repeat(Math.floor(Math.random() * 13));
      const cifras = String(1 + Math.floor(Math.random() * 99));
      caja.value = signo + '0,' + ceros + cifras;
    });
    this.#probar();
  }

  /*
   * Lee cada valor completo, lo convierte en su valor logico (positivo = 1;
   * cero o negativo = -1), busca la fila de la tabla y le pregunta a la neurona.
   */
  #probar() {
    const valores = this.#leerCajas(this.#cajasEntradas, this.#el.avisoEntradas);
    if (!this.#neurona) return;
    if (!valores) {
      this.#el.tablaPrueba.replaceChildren();
      this.#el.resultadoPrueba.textContent = 'Escribe un número en cada caja.';
      return;
    }

    const logicos = valores.map(BaseConocimiento.nivelLogico);
    const fila = this.#base.fila(logicos);
    const pesos = this.#neurona.pesos;
    this.#el.tablaPrueba.replaceChildren(...valores.map((x, i) => {
      const fila = this.#fila([
        'X' + (i + 1), this.#cajasEntradas[i].value.trim(),
        (x > 0 ? 'positivo' : x < 0 ? 'negativo' : 'cero') + ' → ' + Interfaz.signo(logicos[i]),
        String(pesos[i]), String(logicos[i] * pesos[i])]);
      fila.children[1].className = 'largo';      // el valor escrito, por largo que sea
      return fila;
    }));

    const r = this.#neurona.calcular(logicos);
    const bien = r.salida === fila.salida;
    const linea = () => document.createElement('br');
    const marca = (texto, clase) => Object.assign(document.createElement('span'),
                                                  { className: clase, textContent: texto });
    this.#el.resultadoPrueba.replaceChildren(
      'Fila de la tabla: Y' + fila.numero + '  (' + logicos.map(Interfaz.signo).join(', ') + ')',
      linea(), 'Σ(X·ω) − θ = ' + r.potencial, linea(), 'Tanh = ' + r.tanh, linea(),
      'Salida Y = ', marca(Interfaz.signo(r.salida), 'grande ' + (r.salida > 0 ? 'si' : 'no')),
      '    Esperada en la tabla: ' + Interfaz.signo(fila.salida) + ' ',
      marca(bien ? '✓' : '✗', bien ? 'si' : 'no'));
  }

  /* ---------------------------------------------------------------- */
  /* Piezas de HTML                                                     */
  /* ---------------------------------------------------------------- */

  /* Una caja de texto con su etiqueta. Sin maxlength: no hay limite. */
  #crearCaja(contenedor, nombre, alEscribir) {
    const caja = Object.assign(document.createElement('input'), {
      type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false
    });
    caja.addEventListener('input', alEscribir);
    const etiqueta = Object.assign(document.createElement('label'), { textContent: nombre });
    etiqueta.appendChild(caja);
    contenedor.appendChild(etiqueta);
    return caja;
  }

  /* Lee varias cajas; marca en rojo las que no son numero. */
  #leerCajas(cajas, aviso) {
    const valores = cajas.map((caja) => Interfaz.leerNumero(caja.value));
    cajas.forEach((caja, i) => caja.classList.toggle('malo', valores[i] === null));
    const hayMalos = valores.includes(null);
    aviso.hidden = !hayMalos;
    aviso.textContent = 'Hay alguna caja que no es un número.';
    return hayMalos ? null : valores;
  }

  #fila(celdas) {
    const fila = document.createElement('tr');
    celdas.forEach((texto) => fila.appendChild(
      Object.assign(document.createElement('td'), { textContent: texto })));
    return fila;
  }
}

/* Arranque en el navegador, y exportacion para las pruebas con Node. */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => new Interfaz());
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Interfaz };
}
