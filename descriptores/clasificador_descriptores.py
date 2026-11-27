# Descriptores estilo FATS usados para entrenar el clasificador de estrellas variables.
# Código aportado por el autor del clasificador (Random Forest entrenado con OGLE-III);
# se incorpora sin cambios para que los descriptores coincidan exactamente con los del entrenamiento.

"""
Funciones de estadísticos / descriptores sobre magnitudes y tiempos (FATS-style).
"""

import math

import numpy as np
from scipy import stats
from scipy.interpolate import interp1d

__all__ = [
    "safe_len_ok",
    "amplitude",
    "rcs",
    "small_kurtosis",
    "skewness",
    "median_abs_dev",
    "anderson_darling",
    "autocor_length",
    "q31",
    "percent_amplitude",
    "flux_ratio_mid20",
    "flux_ratio_mid35",
    "flux_ratio_mid50",
    "flux_ratio_mid65",
    "flux_ratio_mid80",
    "percent_diff_flux_percentile",
    "median_brp",
    "beyond1std",
    "max_slope",
    "pair_slope_trend",
    "eta_e",
    "structure_function_index_21",
]


def safe_len_ok(x, n_min=3):
    return x is not None and len(x) >= n_min


def amplitude(mag):  # amplitud
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    N = len(mag)
    sorted_mag = np.sort(mag)
    k = int(math.ceil(0.05 * N))
    if k < 1:
        return np.nan
    low = np.median(sorted_mag[:k])
    high = np.median(sorted_mag[-k:])
    return (high - low) / 2.0


def rcs(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    sigma = np.std(mag)
    if sigma == 0:
        return np.nan
    N = len(mag)
    m = np.mean(mag)
    s = np.cumsum(mag - m) / (N * sigma)
    return float(np.max(s) - np.min(s))


def small_kurtosis(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    n = len(mag)
    mean = np.mean(mag)
    std = np.std(mag)
    if std == 0 or n < 4:
        return np.nan
    S = np.sum(((mag - mean) / std) ** 4)
    c1 = float(n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))
    c2 = float(3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
    return c1 * S - c2


def skewness(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    if np.allclose(mag, mag[0]):
        return np.nan
    return float(stats.skew(mag, bias=False))


def median_abs_dev(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    med = np.median(mag)
    return float(np.median(np.abs(mag - med)))


def anderson_darling(mag):
    """AndersonDarling (FATS / Nun et al. 2015): estadístico A-D normalizado."""
    if not safe_len_ok(mag, 5):
        return np.nan
    mag = np.asarray(mag, dtype=float)
    try:
        try:
            ander = stats.anderson(mag, dist="norm", method="interpolate")
        except TypeError:
            ander = stats.anderson(mag, dist="norm")
        n = float(len(mag))
        return float(ander.statistic / (1.0 + 0.75 / n + 2.25 / n**2))
    except Exception:
        return np.nan


def autocor_length(mag, nlags=100):
    """
    Autocor_length (FATS): primer lag donde la ACF cae por debajo de e^{-1}.
    """
    if not safe_len_ok(mag, 3):
        return np.nan
    x = np.asarray(mag, dtype=float)
    x = x - np.mean(x)
    n = len(x)
    var = float(np.dot(x, x))
    if var <= 0 or not np.isfinite(var):
        return np.nan
    maxlag = int(min(nlags, n - 1))
    thres = float(np.exp(-1.0))
    for lag in range(1, maxlag + 1):
        ac = float(np.dot(x[:-lag], x[lag:]) / var)
        if ac < thres:
            return float(lag)
    return float(maxlag)


def q31(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    return float(np.percentile(mag, 75) - np.percentile(mag, 25))


def percent_amplitude(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    med = np.median(mag)
    if med == 0:
        return np.nan
    return float(np.max(np.abs(mag - med)) / med)


def _flux_ratio_core(mag, p_low, p_high):
    mag = np.asarray(mag)
    sorted_data = np.sort(mag)
    n = len(sorted_data)
    if n < 10:
        return np.nan

    def idx(p):
        return int(math.ceil(p * n)) - 1

    try:
        F_low = sorted_data[idx(p_low)]
        F_high = sorted_data[idx(p_high)]
        F_5 = sorted_data[idx(0.05)]
        F_95 = sorted_data[idx(0.95)]
        denom = F_95 - F_5
        if denom == 0:
            return np.nan
        return float((F_high - F_low) / denom)
    except Exception:
        return np.nan


def flux_ratio_mid20(mag):
    return _flux_ratio_core(mag, 0.40, 0.60) if safe_len_ok(mag) else np.nan


def flux_ratio_mid35(mag):
    return _flux_ratio_core(mag, 0.325, 0.675) if safe_len_ok(mag) else np.nan


def flux_ratio_mid50(mag):
    return _flux_ratio_core(mag, 0.25, 0.75) if safe_len_ok(mag) else np.nan


def flux_ratio_mid65(mag):
    return _flux_ratio_core(mag, 0.175, 0.825) if safe_len_ok(mag) else np.nan


def flux_ratio_mid80(mag):
    return _flux_ratio_core(mag, 0.10, 0.90) if safe_len_ok(mag) else np.nan


def percent_diff_flux_percentile(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    med = np.median(mag)
    if med == 0:
        return np.nan
    sorted_data = np.sort(mag)
    n = len(sorted_data)

    def idx(p):
        return int(math.ceil(p * n)) - 1

    try:
        F_5 = sorted_data[idx(0.05)]
        F_95 = sorted_data[idx(0.95)]
        return float((F_95 - F_5) / med)
    except Exception:
        return np.nan


def median_brp(mag):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)
    med = np.median(mag)
    amp = (np.max(mag) - np.min(mag)) / 10.0
    if amp == 0:
        return np.nan
    n = len(mag)
    count = np.sum((mag < med + amp) & (mag > med - amp))
    return float(count) / n


def beyond1std(mag, err=None):
    if not safe_len_ok(mag):
        return np.nan
    mag = np.asarray(mag)

    if err is not None and safe_len_ok(err) and len(err) == len(mag):
        err = np.asarray(err)
        weights = 1.0 / (err**2 + 1e-12)
        mean = np.average(mag, weights=weights)
    else:
        mean = np.mean(mag)

    n = len(mag)
    if n <= 1:
        return np.nan
    std = np.std(mag, ddof=1)
    if std == 0:
        return np.nan
    count = np.sum((mag > mean + std) | (mag < mean - std))
    return float(count) / n


def max_slope(mag, time):
    if not (safe_len_ok(mag, 2) and safe_len_ok(time, 2)):
        return np.nan
    mag = np.asarray(mag)
    time = np.asarray(time)
    dt = time[1:] - time[:-1]
    dm = mag[1:] - mag[:-1]
    mask = dt != 0
    if not np.any(mask):
        return np.nan
    return float(np.max(np.abs(dm[mask] / dt[mask])))


def pair_slope_trend(mag):
    if not safe_len_ok(mag, 30):
        return np.nan
    mag = np.asarray(mag)
    last = mag[-30:]
    diffs = np.diff(last)
    inc = np.sum(diffs > 0)
    dec = np.sum(diffs <= 0)
    return float((inc - dec) / 30.0)


def eta_e(mag, time):
    if not (safe_len_ok(mag, 3) and safe_len_ok(time, 3)):
        return np.nan
    mag = np.asarray(mag)
    time = np.asarray(time)

    dt = time[1:] - time[:-1]
    mask = dt != 0
    if np.sum(mask) < 2:
        return np.nan

    dt = dt[mask]
    mag1 = mag[:-1][mask]
    mag2 = mag[1:][mask]

    w = 1.0 / (dt**2)
    w_mean = np.mean(w)
    N = len(time)
    sigma2 = np.var(mag)
    if sigma2 == 0 or N <= 1:
        return np.nan
    S1 = np.sum(w * (mag2 - mag1) ** 2)
    S2 = np.sum(w)
    return float(w_mean * ((time[-1] - time[0]) ** 2) * S1 / (sigma2 * S2 * (N**2)))


def structure_function_index_21(mag, time):
    if not (safe_len_ok(mag, 10) and safe_len_ok(time, 10)):
        return np.nan
    mag = np.asarray(mag)
    time = np.asarray(time)

    order = np.argsort(time)
    t_sorted = time[order]
    m_sorted = mag[order]

    Np = 100
    if np.max(t_sorted) == np.min(t_sorted):
        return np.nan

    try:
        f = interp1d(t_sorted, m_sorted, kind="linear", fill_value="extrapolate")
        time_int = np.linspace(np.min(t_sorted), np.max(t_sorted), Np)
        mag_int = f(time_int)
    except Exception:
        return np.nan

    Nsf = 100
    sf1 = np.zeros(Nsf)
    sf2 = np.zeros(Nsf)

    for tau in range(1, Nsf + 1):
        if tau >= Np:
            break
        diff = mag_int[:-tau] - mag_int[tau:]
        sf1[tau - 1] = np.mean(np.abs(diff) ** 1.0)
        sf2[tau - 1] = np.mean(np.abs(diff) ** 2.0)

    sf1 = np.trim_zeros(sf1)
    sf2 = np.trim_zeros(sf2)
    mask = (sf1 > 0) & (sf2 > 0)
    if np.sum(mask) < 2:
        return np.nan

    sf1_log = np.log10(sf1[mask])
    sf2_log = np.log10(sf2[mask])

    try:
        m_21, _ = np.polyfit(sf1_log, sf2_log, 1)
        return float(m_21)
    except Exception:
        return np.nan
