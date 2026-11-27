// PU-01 a PU-04 — Lectura de archivos de curvas de luz (CU-02, RF-01)
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isSentinel, parseFile } from "../data/parseFile";

describe("parseFile", () => {
  it("PU-01: lee un CSV con encabezado (3 columnas y 10 filas)", () => {
    const filas = Array.from({ length: 10 }, (_, i) => `${2450000 + i}.5,${(15 + i * 0.01).toFixed(3)},0.02`);
    const r = parseFile(["time,mag,err", ...filas].join("\n"));

    expect(r.headers).toEqual(["time", "mag", "err"]);
    expect(r.rows).toHaveLength(10);
    expect(r.headerSource).toBe("file");
    expect(r.rows[0]).toEqual({ time: "2450000.5", mag: "15.000", err: "0.02" });
  });

  it("PU-02: formato MACHO — toma el encabezado del comentario y omite la fila de unidades", () => {
    const contenido = [
      "# MACHO 9.5482.957",
      "# HJD r err_r",
      "# (days) (mag) (mag)",
      "49000.10 -5.123 0.021",
      "49001.20 -5.201 0.019",
      "49002.30 -5.087 0.022",
      "49003.40 -5.150 0.020",
      "49004.50 -5.176 0.018",
    ].join("\n");
    const r = parseFile(contenido);

    // looksLikeUnits descarta "(days) (mag) (mag)" y expectedCols elige la línea de 3 columnas
    expect(r.headers).toEqual(["HJD", "r", "err_r"]);
    expect(r.rows).toHaveLength(5);
    expect(r.rows.some((f) => Object.values(f).some((v) => v.startsWith("(")))).toBe(false);
    expect(r.metadata).toContain("# (days) (mag) (mag)");
  });

  it("PU-02b: archivo MACHO real de ejemplo (532 observaciones, 7 columnas)", () => {
    const ruta = path.resolve(__dirname, "../../public/ejemplos/9.5482.957.publc.txt");
    const r = parseFile(readFileSync(ruta, "utf8"));

    expect(r.headers).toEqual(["HJD-2.449e+06", "r", "err_r", "b", "err_b", "obsid", "tran"]);
    expect(r.rows).toHaveLength(532);
    expect(r.rows.every((f) => !Number.isNaN(Number(f["HJD-2.449e+06"])))).toBe(true);
  });

  it("PU-03: lee archivos separados por espacios (.dat) y por tabulaciones (.tab)", () => {
    const dat = "HJD  mag   err\n1.0  15.1  0.02\n2.0   15.2 0.03\n3.0 15.3  0.01";
    const tab = "HJD\tmag\terr\n1.0\t15.1\t0.02\n2.0\t15.2\t0.03\n3.0\t15.3\t0.01";

    for (const contenido of [dat, tab]) {
      const r = parseFile(contenido);
      expect(r.headers).toEqual(["HJD", "mag", "err"]);
      expect(r.rows).toHaveLength(3);
      expect(r.rows[1]).toEqual({ HJD: "2.0", mag: "15.2", err: "0.03" });
    }
  });

  it("PU-04: un archivo vacío no se cae: devuelve 0 columnas y 0 filas (la interfaz muestra el aviso)", () => {
    for (const contenido of ["", "\n\n   \n", "# solo comentarios\n# sin datos"]) {
      const r = parseFile(contenido);
      expect(r.headers).toEqual([]);
      expect(r.rows).toEqual([]);
    }
  });

  it("PU-04b: reconoce los valores centinela (-99, NaN, vacío) como dato faltante", () => {
    expect(isSentinel("-99")).toBe(true);
    expect(isSentinel("NaN")).toBe(true);
    expect(isSentinel("")).toBe(true);
    expect(isSentinel("15.23")).toBe(false);
  });
});
