import numpy as np
from scipy.optimize import minimize_scalar


def _matriz(t, P, n_arm):
    t0 = t[0]
    cols = [np.ones_like(t)]
    for k in range(1, n_arm + 1):
        a = 2 * np.pi * k * (t - t0) / P
        cols += [np.cos(a), np.sin(a)]
    return np.column_stack(cols)


def _ajustar(t, y, w, P, n_arm):
    X = _matriz(t, P, n_arm)
    coef, *_ = np.linalg.lstsq(X * w[:, None], y * w, rcond=None)
    resid = y - X @ coef
    return coef, float(np.sum((w * resid) ** 2)), resid


def analizar_fourier(t, y, err, periodo_ls, n_arm=4, ancho_relativo_max=None):
    """Ajuste de serie de Fourier a la manera de OGLE: período refinado por
    mínimos cuadrados y R_k1 = A_k / A_1, phi_k1 = phi_k - k*phi_1 (en rad)."""
    t = np.asarray(t, float)
    y = np.asarray(y, float)
    w = 1.0 / np.maximum(np.asarray(err, float), 1e-3) if err is not None else np.ones_like(y)

    # 1) Refinar el período: grilla fina alrededor del de Lomb-Scargle
    base = t.max() - t.min()
    ancho = 5 * periodo_ls**2 / base
    if ancho_relativo_max is not None:
        # El período ya viene refinado (selección multiarmónica): solo se ajusta fino,
        # sin permitir saltos a otro submúltiplo.
        ancho = min(ancho, ancho_relativo_max * periodo_ls)
    grilla = np.linspace(periodo_ls - ancho, periodo_ls + ancho, 4001)
    chi = [_ajustar(t, y, w, p, n_arm)[1] for p in grilla]
    i = int(np.argmin(chi))
    paso = grilla[1] - grilla[0]
    P = minimize_scalar(
        lambda p: _ajustar(t, y, w, p, n_arm)[1],
        bounds=(grilla[i] - paso, grilla[i] + paso), method="bounded",
    ).x

    # 2) Un paso de recorte a 4 sigma y reajuste
    coef, _, resid = _ajustar(t, y, w, P, n_arm)
    sigma = 1.4826 * np.median(np.abs(resid - np.median(resid)))
    if sigma > 0:
        ok = np.abs(resid) < 4 * sigma
        if ok.sum() > 3 * n_arm + 5:
            t, y, w = t[ok], y[ok], w[ok]
            coef, _, _ = _ajustar(t, y, w, P, n_arm)

    # 3) Amplitudes y fases por armónico
    c, s = coef[1::2], coef[2::2]
    A = np.hypot(c, s)
    phi = np.arctan2(-s, c)
    t0 = float(t[0])  # origen de fase usado en el ajuste (puede cambiar tras el recorte)
    f = np.linspace(0, 1, 500, endpoint=False)
    modelo = coef[0] + sum(
        c[k] * np.cos(2 * np.pi * (k + 1) * f) + s[k] * np.sin(2 * np.pi * (k + 1) * f)
        for k in range(n_arm)
    )
    return {
        "periodo": float(P),
        "R21": float(A[1] / A[0]),
        "R31": float(A[2] / A[0]),
        "phi21": float((phi[1] - 2 * phi[0]) % (2 * np.pi)),
        "phi31": float((phi[2] - 3 * phi[0]) % (2 * np.pi)),
        "amplitud_pico_a_pico": float(np.ptp(modelo)),
        "n_armonicos": n_arm,
        "t_valor_minimo": t0 + float(f[int(np.argmin(modelo))]) * float(P),
        "t_valor_maximo": t0 + float(f[int(np.argmax(modelo))]) * float(P),
    }