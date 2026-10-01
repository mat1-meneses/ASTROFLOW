// Muestra el texto del reporte (Markdown simple del LLM) SIN dangerouslySetInnerHTML.
// El texto viene de un modelo de lenguaje, así que nunca se inserta como HTML:
// se convierte a elementos de React, que escapan cualquier etiqueta.
// Soporta: títulos (#, ##, ###), párrafos separados por línea en blanco y **negrita**.

import type { CSSProperties, ReactNode } from "react";

interface Props {
  texto: string;
  /** Estilos opcionales (PrintView usa estilos en línea en vez de Tailwind). */
  estilos?: { titulo?: CSSProperties; parrafo?: CSSProperties };
  clases?: { titulo?: string; parrafo?: string };
}

function conNegritas(linea: string): ReactNode[] {
  return linea.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") ? (
      <strong key={i}>{parte.slice(2, -2)}</strong>
    ) : (
      parte
    )
  );
}

export default function TextoReporte({ texto, estilos, clases }: Props) {
  const bloques = texto
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <>
      {bloques.map((bloque, i) => {
        const titulo = bloque.match(/^#{1,3}\s+(.+)$/);
        if (titulo && !bloque.includes("\n")) {
          return (
            <h3 key={i} className={clases?.titulo} style={estilos?.titulo}>
              {conNegritas(titulo[1])}
            </h3>
          );
        }
        // Un título seguido de texto en el mismo bloque: se separa.
        const [primera, ...resto] = bloque.split("\n");
        const tituloInicial = primera.match(/^#{1,3}\s+(.+)$/);
        if (tituloInicial) {
          return (
            <div key={i}>
              <h3 className={clases?.titulo} style={estilos?.titulo}>
                {conNegritas(tituloInicial[1])}
              </h3>
              <p className={clases?.parrafo} style={estilos?.parrafo}>
                {conNegritas(resto.join(" "))}
              </p>
            </div>
          );
        }
        return (
          <p key={i} className={clases?.parrafo} style={estilos?.parrafo}>
            {conNegritas(bloque.replace(/\n/g, " "))}
          </p>
        );
      })}
    </>
  );
}
