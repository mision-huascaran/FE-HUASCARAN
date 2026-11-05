// GraficaLineas — el mes del borde no se recorta.
//
// "Diciembre" salía como "Diciembr": su etiqueta se dibuja centrada en el
// ÚLTIMO punto, y con poco margen derecho, la mitad derecha del texto caía
// fuera del viewBox. Un SVG sin overflow visible no avisa de eso: lo corta en
// seco, sin error ni consola.
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import GraficaLineas from '../GraficaLineas'

const ANCHO = 680

const datos = [
  { nombre: 'Octubre', porcentaje: 80 },
  { nombre: 'Noviembre', porcentaje: 95 },
  { nombre: 'Diciembre', porcentaje: 100 },
]

describe('GraficaLineas', () => {
  it('el margen derecho deja sitio para el nombre completo del último mes', () => {
    /*
     * Prueba de geometría, no de píxeles reales: jsdom no mide fuentes. Lo
     * que se sujeta es que el margen sea SUFICIENTE para una etiqueta larga
     * ("Diciembre", "Noviembre", "Setiembre"), no que el texto quepa en un
     * margen que alguien reduzca sin darse cuenta de por qué es ancho.
     *
     * A ~5.5px por carácter a 10px de fuente, una etiqueta de 9 letras mide
     * ~27px de mitad — el mismo cálculo que dejó este margen en 36.
     */
    const { container } = render(<GraficaLineas datos={datos} campo="porcentaje" />)
    const textos = [...container.querySelectorAll('text')]
    const ultimo = textos.find((t) => t.textContent === 'Diciembre')
    expect(ultimo).toBeTruthy()

    const x = Number(ultimo.getAttribute('x'))
    const mediaAnchoEstimado = 27 // "Diciembre": 9 caracteres × ~3px a fontSize 10, con margen
    expect(x + mediaAnchoEstimado).toBeLessThanOrEqual(ANCHO)
  })

  it('el primer mes tampoco se recorta por la izquierda', () => {
    const { container } = render(<GraficaLineas datos={datos} campo="porcentaje" />)
    const textos = [...container.querySelectorAll('text')]
    const primero = textos.find((t) => t.textContent === 'Octubre')
    const x = Number(primero.getAttribute('x'))
    expect(x - 24).toBeGreaterThanOrEqual(0)
  })
})
