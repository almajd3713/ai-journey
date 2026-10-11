"""Build the terrain for the site from the network trained in basic Session 6.

The network, data, seed and optimiser are copied from the notebook's section 5
(XOR, 2-4-1 with tanh and a sigmoid output, Adam lr 0.05, 500 epochs, seed 42), and
the script checks that it reproduces the losses the notebook printed. It saves the
weights after every step, finds the plane that best fits the trajectory (PCA of the
weights minus the final weights, as in Li et al. 2018), evaluates the real loss on a
grid in that plane, and projects the trajectory onto it.

Outputs (in <out>/terrain/):
  height.f32       coarse grid, float32 log-loss, row-major, N x N
  terrain.json     grid extents, trajectory, true losses, PCA info, provenance
  preview.png      contour preview for a visual check
  slices.json      other slices through the final weights (other directions), and the
                   same network trained at other learning rates ("other dives")
  slice-<id>.f32   each slice's grid, float32 log-loss, SLICE_N x SLICE_N

Run:  python -I tools/make_landscape.py public
"""
import json
import platform
import sys
from pathlib import Path

import numpy as np
import torch
from torch import nn

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "public") / "terrain"
N = 257
SLICE_N = 129
SEED = 42
# Other dives: the same network, data and seed, trained with Adam at these learning rates
OTHER_LRS = [0.005, 0.02, 0.1, 0.2, 0.5]
# a run is drawn on the chart only if it stays in the chart's plane: at least this share
# of its movement lies in the plane, and the surface under its projected path is within
# this many units of ln(loss) of its true loss at every step
FIT_MIN = 0.85
DEPTH_MAX = 0.25
# The notebook's printed values (session_06_neural_networks.ipynb, section 5)
EXPECTED = {0: 0.760, 99: 0.025, 499: 0.00229}


def build():
    torch.manual_seed(SEED)
    model = nn.Sequential(nn.Linear(2, 4), nn.Tanh(), nn.Linear(4, 1), nn.Sigmoid())
    return model


X = torch.tensor([[0.0, 0.0], [0.0, 1.0], [1.0, 0.0], [1.0, 1.0]], dtype=torch.float32)
Y = torch.tensor([0, 1, 1, 0], dtype=torch.float32).unsqueeze(1)
loss_fn = nn.BCELoss()


def flat(model):
    return torch.cat([p.detach().reshape(-1) for p in model.parameters()]).double().numpy()


def train(lr=0.05):
    model = build()
    opt = torch.optim.Adam(model.parameters(), lr=lr)
    weights, losses = [flat(model)], []
    for _ in range(500):
        loss = loss_fn(model(X), Y)
        opt.zero_grad()
        loss.backward()
        opt.step()
        losses.append(loss.item())  # loss before this step, as the notebook records it
        weights.append(flat(model))
    final_loss = loss_fn(model(X), Y).item()
    return np.array(weights), np.array(losses), final_loss


def batch_loss(W):
    """True BCE loss for many weight vectors at once. W: (m, 17) float64."""
    w1 = W[:, 0:8].reshape(-1, 4, 2)
    b1 = W[:, 8:12]
    w2 = W[:, 12:16]
    b2 = W[:, 16]
    x = X.double().numpy()
    y = Y.double().numpy().ravel()
    h = np.tanh(np.einsum("mij,nj->mni", w1, x) + b1[:, None, :])  # (m, 4 rows, 4 units)
    z = np.einsum("mni,mi->mn", h, w2) + b2[:, None]
    # BCELoss clamps log at -100; log-sigmoid form is the stable equivalent
    logp = -np.logaddexp(0, -z)
    log1mp = -np.logaddexp(0, z)
    return -(y * np.maximum(logp, -100) + (1 - y) * np.maximum(log1mp, -100)).mean(axis=1)


def grid(center, d1, d2, xr, yr, n):
    a = np.linspace(xr[0], xr[1], n)
    b = np.linspace(yr[0], yr[1], n)
    A, B = np.meshgrid(a, b)  # row = y (b), column = x (a)
    W = center + A.reshape(-1, 1) * d1 + B.reshape(-1, 1) * d2
    return batch_loss(W).reshape(n, n)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    W, losses, final_loss = train()
    for k, v in EXPECTED.items():
        got = round(losses[k], 3 if v >= 0.01 else 5)
        assert abs(got - v) < 1e-9, f"epoch {k + 1}: got {losses[k]}, notebook printed {v}"
    print("reproduces the notebook:", {k + 1: round(losses[k], 5) for k in EXPECTED})

    final = W[-1]
    D = W - final
    U, S, Vt = np.linalg.svd(D, full_matrices=False)
    d1, d2 = Vt[0], Vt[1]
    explained = (S**2 / (S**2).sum())[:2]
    # direction signs: start at the top left of the chart, descend to the right
    P = D @ np.stack([d1, d2], 1)
    if P[0, 0] > 0:
        d1, P[:, 0] = -d1, -P[:, 0]
    if P[0, 1] > 0:
        d2, P[:, 1] = -d2, -P[:, 1]
    print("explained variance of the top two directions:", explained.round(4), "sum", explained.sum().round(4))

    # square extent around the trajectory, with margin
    lo, hi = P.min(0), P.max(0)
    c = (lo + hi) / 2
    half = (hi - lo).max() / 2 * 1.32
    xr = [c[0] - half, c[0] + half]
    yr = [c[1] - half, c[1] + half]
    Z = grid(final, d1, d2, xr, yr, N)

    # loss along the projected trail (what the ground shows) and the true loss (what the gauge shows)
    trail_surface = batch_loss(final + P[:, :1] * d1 + P[:, 1:] * d2)
    true_loss = np.append(losses, final_loss)  # loss at weights[i], i = 0..500

    logZ = np.log(Z).astype(np.float32)
    logZ.tofile(OUT / "height.f32")
    meta = {
        "about": "Loss landscape of basic Session 6's XOR network (2-4-1, tanh, sigmoid; Adam lr 0.05, 500 epochs, seed 42). "
        "Plane: the top two principal directions of the training trajectory, centred on the final weights (Li et al. 2018). "
        "Height: natural log of the true BCE training loss on that plane.",
        "n": N,
        "x": xr,
        "y": yr,
        "min": float(logZ.min()),
        "max": float(logZ.max()),
        "explained": [round(float(e), 5) for e in explained],
        "steps": len(losses),
        "trail": [[round(float(a), 5), round(float(b), 5)] for a, b in P],
        "trailSurfaceLoss": [round(float(v), 6) for v in trail_surface],
        "trueLoss": [round(float(v), 6) for v in true_loss],
        "params": int(W.shape[1]),
        "provenance": {
            "notebook": "ai_journey_third_edition/session_06_neural_networks.ipynb, section 5",
            "check": {f"epoch {k + 1}": v for k, v in EXPECTED.items()},
            "python": platform.python_version(),
            "torch": torch.__version__,
            "numpy": np.__version__,
            "script": "website/tools/make_landscape.py",
        },
    }
    (OUT / "terrain.json").write_text(json.dumps(meta, separators=(",", ":")))

    # other slices through the final weights: the first and third principal directions (the
    # plane misses the third), and two random directions (seeded, orthonormal)
    rng = np.random.default_rng(SEED)
    r = rng.standard_normal((2, W.shape[1]))
    r1 = r[0] / np.linalg.norm(r[0])
    r2 = r[1] - (r[1] @ r1) * r1
    r2 /= np.linalg.norm(r2)
    share = S**2 / (S**2).sum()
    slices = []
    for sid, a_dir, b_dir, label in [
        ("pc1-pc3", d1, Vt[2], "First and third principal directions"),
        ("random", r1, r2, "Two random directions"),
    ]:
        Ps = D @ np.stack([a_dir, b_dir], 1)
        moved = float(((D @ np.stack([a_dir, b_dir], 1)) ** 2).sum() / (D**2).sum())
        cs = (Ps.min(0) + Ps.max(0)) / 2
        sx, sy = [cs[0] - half, cs[0] + half], [cs[1] - half, cs[1] + half]
        Zs = np.log(grid(final, a_dir, b_dir, sx, sy, SLICE_N)).astype(np.float32)
        Zs.tofile(OUT / f"slice-{sid}.f32")
        slices.append({
            "id": sid, "label": label, "n": SLICE_N, "x": sx, "y": sy,
            "min": float(Zs.min()), "max": float(Zs.max()),
            "moved": round(moved, 5),
            "trail": [[round(float(a), 5), round(float(b), 5)] for a, b in Ps],
            "trailSurfaceLoss": [round(float(v), 6) for v in batch_loss(final + Ps[:, :1] * a_dir + Ps[:, 1:] * b_dir)],
        })
        print(f"slice {sid}: {moved * 100:.2f}% of the path's movement; log-loss {Zs.min():.2f} .. {Zs.max():.2f}")
    # the chart's own plane, for comparison
    print(f"slice pc1-pc2 (the chart): {share[:2].sum() * 100:.2f}%")

    # other dives: train again at other learning rates and measure how well each run fits
    # the chart's plane before drawing it there
    B = np.stack([d1, d2], 1)
    runs = []
    for lr in OTHER_LRS:
        Wr, lr_losses, lr_final = train(lr)
        Dr = Wr - final
        Pr = Dr @ B
        R = Dr - Pr @ B.T
        fit = float(1 - (R**2).sum() / (Dr**2).sum())
        true_r = np.append(lr_losses, lr_final)
        surf_r = batch_loss(final + Pr @ B.T)
        depth_err = float(np.abs(np.log(surf_r) - np.log(true_r)).max())
        on_chart = fit >= FIT_MIN and depth_err <= DEPTH_MAX
        assert np.isfinite(true_r).all()
        runs.append({
            "lr": lr, "fit": round(fit, 4), "depthErr": round(depth_err, 3), "onChart": on_chart,
            "trueLoss": [round(float(v), 7) for v in true_r],
            **({"trail": [[round(float(a), 5), round(float(b), 5)] for a, b in Pr]} if on_chart else {}),
        })
        print(f"lr {lr}: fit {fit:.3f}, depth error {depth_err:.2f} -> {'on the chart' if on_chart else 'off the plane'}; final loss {true_r[-1]:.5g}")
    (OUT / "slices.json").write_text(json.dumps({
        "about": "Other slices through the final weights, and the Session 6 network trained at other learning rates "
        "(same data, seed and initial weights; Adam). A run is drawn on the chart only if it stays in the chart's plane.",
        "fitMin": FIT_MIN, "depthMax": DEPTH_MAX, "chartMoved": round(float(share[:2].sum()), 5),
        "slices": slices, "runs": runs,
    }, separators=(",", ":")))
    print(f"grid log-loss {logZ.min():.3f} .. {logZ.max():.3f}; loss {Z.min():.5f} .. {Z.max():.3f}")
    print(f"trail surface loss {trail_surface[0]:.4f} -> {trail_surface[-1]:.5f}; true {true_loss[0]:.4f} -> {true_loss[-1]:.5f}")

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(7, 6.6))
        for Zl, ex, ey, title in [(logZ, xr, yr, "log loss")]:
            ax.contourf(np.linspace(*ex, Zl.shape[1]), np.linspace(*ey, Zl.shape[0]), Zl, levels=40, cmap="viridis_r")
            ax.contour(np.linspace(*ex, Zl.shape[1]), np.linspace(*ey, Zl.shape[0]), Zl, levels=40, colors="k", linewidths=0.3)
            ax.plot(P[:, 0], P[:, 1], color="#ff3b3b", lw=1.6)
            ax.plot(*P[0], "o", color="w", mec="k")
            ax.plot(*P[-1], "*", color="w", mec="k", ms=12)
            ax.set(xlim=ex, ylim=ey, title=title, aspect="equal")
            ax.invert_yaxis()
        fig.suptitle(f"Session 6 XOR network: log loss, PCA plane ({explained.sum() * 100:.1f}% of the trajectory)")
        fig.tight_layout()
        fig.savefig(OUT / "preview.png", dpi=90)
    except ImportError:
        pass


if __name__ == "__main__":
    main()
