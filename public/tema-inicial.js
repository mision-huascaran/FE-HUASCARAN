// Aplica el tema guardado ANTES de pintar, para que recargar en oscuro no enseñe
// un destello claro. Va en un archivo aparte, y no en línea, porque la CSP es
// `script-src 'self'`. La misma lógica, ya con estado, vive en hooks/useTema.js.
(function () {
  var preferencia = 'sistema'
  try {
    preferencia = window.localStorage.getItem('sicedu.tema') || 'sistema'
  } catch (e) {
    // Sin acceso al almacenamiento se sigue la preferencia del sistema.
  }
  var oscuro =
    preferencia === 'oscuro' ||
    (preferencia !== 'claro' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', Boolean(oscuro))
})()
