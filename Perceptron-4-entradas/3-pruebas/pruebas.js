/*
 * pruebas.js — Comprobaciones del perceptron. Se corren con Node:
 *   node 3-pruebas/pruebas.js
 */
'use strict';

const { FuncionActivacion, TangenteHiperbolica, EscalonBipolar,
        BaseConocimiento, Neurona, Perceptron } = require('../1-aplicacion/js/perceptron.js');

// la interfaz usa las clases del modelo como globales, igual que en el navegador
Object.assign(globalThis, { Perceptron, BaseConocimiento, Neurona });
const { Interfaz } = require('../1-aplicacion/js/interfaz.js');

let fallos = 0;
let total = 0;

function comprobar(descripcion, condicion) {
  total += 1;
  if (!condicion) fallos += 1;
  console.log((condicion ? '  ok    ' : '  FALLA ') + descripcion);
}

console.log('\nLa tabla de la compuerta');
const filas = new BaseConocimiento().filas;
comprobar('tiene 16 filas de 4 entradas', filas.length === 16 && filas[0].entradas.length === 4);
comprobar('no hay filas repetidas', new Set(filas.map((f) => f.entradas.join())).size === 16);
comprobar('Y = +1 solo si X1 = 1 y alguna de X2, X3, X4 vale 1', filas.every((f) => {
  const [x1, x2, x3, x4] = f.entradas;
  return f.salida === ((x1 === 1 && (x2 === 1 || x3 === 1 || x4 === 1)) ? 1 : -1);
}));

console.log('\nProgramacion orientada a objetos');
comprobar('FuncionActivacion es abstracta: no se puede crear',
  (() => { try { new FuncionActivacion(); return false; } catch (e) { return true; } })());
comprobar('TangenteHiperbolica y EscalonBipolar heredan de ella',
  new TangenteHiperbolica() instanceof FuncionActivacion &&
  new EscalonBipolar() instanceof FuncionActivacion);
const n = new Neurona([1, 2, 3, 4], 0.5);
comprobar('los atributos de la neurona son privados', Object.keys(n).length === 0);
const copia = n.pesos;
copia[0] = 999;
comprobar('cambiar la copia de los pesos no cambia la neurona', n.pesos[0] === 1);

console.log('\nLas formulas');
const r = n.calcular([1, 1, 1, 1]);
comprobar('potencial = SUM(x*w) - theta', r.potencial === 1 + 2 + 3 + 4 - 0.5);
comprobar('la salida es el signo de la tangente hiperbolica',
  r.tanh === Math.tanh(r.potencial) && r.salida === 1);
const a = new Neurona([0, 0, 0, 0], 0);
a.ajustar([1, -1, 1, -1], 1, 0.5);
comprobar('ajuste: w = w + 2*E*Y*x  y  theta = theta + 2*E*Y*(-1)',
  a.pesos.join() === '1,-1,1,-1' && a.theta === -1);

console.log('\nNo se aproxima nada');
comprobar('"0,0000000000001" se lee como 0.0000000000001, no como cero',
  Interfaz.leerNumero('0,0000000000001') === 0.0000000000001);
comprobar('acepta punto, coma y notacion cientifica por igual',
  Interfaz.leerNumero('0.0000000000001') === Interfaz.leerNumero('1e-13'));
comprobar('no hay limite de cifras',
  Interfaz.leerNumero('0,' + '0'.repeat(60) + '12345') === 12345e-65);
comprobar('un texto que no es numero se rechaza', Interfaz.leerNumero('abc') === null);
comprobar('un positivo con 400 ceros sigue siendo positivo',
  BaseConocimiento.nivelLogico(Interfaz.leerNumero('0,' + '0'.repeat(400) + '1')) === 1);
comprobar('un negativo con 400 ceros sigue siendo negativo',
  BaseConocimiento.nivelLogico(Interfaz.leerNumero('-0,' + '0'.repeat(400) + '1')) === -1);
comprobar('un numero de 400 cifras se acepta y es positivo',
  BaseConocimiento.nivelLogico(Interfaz.leerNumero('9'.repeat(400))) === 1);
comprobar('cero escrito con muchos ceros sigue siendo cero',
  Interfaz.leerNumero('0,' + '0'.repeat(400)) === 0);

console.log('\nValores reales: cuentan por su signo');
comprobar('0,0000000000001 es positivo: cuenta como 1, no como cero',
  BaseConocimiento.nivelLogico(Interfaz.leerNumero('0,0000000000001')) === 1);
comprobar('el cero y los negativos cuentan como -1',
  BaseConocimiento.nivelLogico(0) === -1 && BaseConocimiento.nivelLogico(-0.0000000000001) === -1);
const base = new BaseConocimiento();
const ejemplo = [0.0000000000001, 0.85, -0.0000003, 2.7].map(BaseConocimiento.nivelLogico);
comprobar('(0,0000000000001; 0,85; -0,0000003; 2,7) es la fila Y14, (1, 1, -1, 1), que da +1',
  base.fila(ejemplo).numero === 14 && base.fila(ejemplo).salida === 1);

console.log('\nEntrenamiento (300 corridas)');
let todasAprenden = true;
let respetanLimite = true;
let cancelados = 0;
for (let k = 0; k < 300; k++) {
  const p = new Perceptron(new BaseConocimiento());
  p.entrenar();
  cancelados += p.intentos.filter((i) => !i.aprendio).length;
  if (p.intentos.some((i) => i.iteraciones > Perceptron.LIMITE)) respetanLimite = false;
  if (!p.aprendio || filas.some((f) => p.neurona.calcular(f.entradas).salida !== f.salida)) {
    todasAprenden = false;
    break;
  }
}
comprobar('todas aprenden las 16 filas', todasAprenden);

// con la neurona entrenada, cualquier valor real da la salida de su fila de la tabla
let realesBien = true;
for (let k = 0; k < 100 && realesBien; k++) {
  const p = new Perceptron(new BaseConocimiento());
  p.entrenar();
  for (let j = 0; j < 50; j++) {
    const valores = Array.from({ length: 4 }, () =>
      (Math.random() < 0.5 ? -1 : 1) * Math.pow(10, -13 + Math.random() * 13.4));
    const logicos = valores.map(BaseConocimiento.nivelLogico);
    if (p.neurona.calcular(logicos).salida !== base.fila(logicos).salida) realesBien = false;
  }
}
comprobar('con valores reales cualesquiera, la salida es siempre la de su fila', realesBien);
comprobar('ningun intento pasa de 999 iteraciones', respetanLimite);
comprobar('a veces se cancela un intento y se sortea de nuevo', cancelados > 0);

console.log('\n' + (fallos ? fallos + ' fallos de ' : 'Todo en orden: ') + total + ' comprobaciones.\n');
process.exit(fallos ? 1 : 0);
