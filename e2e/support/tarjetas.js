// Tarjetas de indicadores (StatCard) de los Inicio.
//
// FRÁGIL: StatCard no tiene rol ni data-testid. La etiqueta y el valor son dos
// <p> hermanos, y la tarjeta solo se distingue por sus clases. Pedir al
// frontend `data-testid="stat-card"` en la tarjeta y `data-testid="stat-card-valor"`
// en el valor (o `role="group"` con `aria-label={label}`).
const etiquetaDe = (page, etiqueta) => page.getByRole('main').getByText(etiqueta, { exact: true })

export const tarjeta = (page, etiqueta) => etiquetaDe(page, etiqueta).locator('xpath=ancestor::div[contains(@class,"shadow-card")][1]')

export const valorDeTarjeta = (page, etiqueta) => etiquetaDe(page, etiqueta).locator('xpath=following-sibling::p[1]')

/** Todas las tarjetas de indicadores de la pantalla. */
export const tarjetas = (page) => page.getByRole('main').locator('div.rounded-xl.shadow-card:has(> div > div > p + p)')
