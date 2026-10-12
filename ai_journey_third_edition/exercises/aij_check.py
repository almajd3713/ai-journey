"""Tiny self-checks for the 'Your turn' exercises: plain checks with friendly messages, no grading server.

    from aij_check import check, close, summary
    check("the baseline is about 0.32", lambda: close(baseline, 0.316, 0.01), "Predict the most common training class for every test flower.")
    summary()

`check` runs the condition you pass as a function, so an unfinished task (still `...` or None) shows a hint instead of an error.
"""
import numpy as np

_results = []


def close(a, b, tol=1e-6):
    """True when a and b (numbers or arrays) agree to within tol."""
    return bool(np.allclose(np.asarray(a, dtype=float), np.asarray(b, dtype=float), atol=tol, rtol=0))


def check(label, condition, hint=""):
    """Print a tick or a cross for one requirement. `condition` is a function returning True or False."""
    try:
        ok = bool(condition())
        note = hint
    except Exception as error:                      # an unfinished task: say so, and show the reason briefly
        ok, note = False, f"not finished yet ({type(error).__name__}: {str(error)[:80]}). {hint}".strip()
    _results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + label + ("" if ok or not note else "\n      hint: " + note))
    return ok


def summary():
    """Print how many checks passed since the last summary, then reset."""
    n, ok = len(_results), sum(_results)
    print(f"\n{ok} of {n} checks passed." + ("  Well done." if n and ok == n else ""))
    _results.clear()
