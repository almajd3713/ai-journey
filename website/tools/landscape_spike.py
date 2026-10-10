"""Feasibility spike: is a real loss surface (Li et al. 2018, PCA-of-trajectory plane)
interesting enough to be the site's terrain?"""
import sys, json
import numpy as np, torch, torch.nn as nn
from sklearn.datasets import make_moons
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt

out = sys.argv[1]
torch.manual_seed(0); np.random.seed(0)
X, y = make_moons(1000, noise=0.25, random_state=0)
X = torch.tensor(X, dtype=torch.float32); y = torch.tensor(y, dtype=torch.float32)[:, None]

def make():
    return nn.Sequential(nn.Linear(2, 16), nn.Tanh(), nn.Linear(16, 16), nn.Tanh(), nn.Linear(16, 1))

net = make()
with torch.no_grad():  # start somewhere high: scale the init up
    for p in net.parameters(): p.mul_(2.5)
lossf = nn.BCEWithLogitsLoss()
flat = lambda m: torch.cat([p.detach().flatten() for p in m.parameters()]).clone()

def set_flat(m, v):
    i = 0
    for p in m.parameters():
        n = p.numel(); p.data.copy_(v[i:i+n].view_as(p)); i += n

opt = torch.optim.SGD(net.parameters(), lr=0.3, momentum=0.9)
STEPS = 3000
traj, losses = [flat(net)], []
for s in range(STEPS):
    opt.zero_grad(); l = lossf(net(X), y); l.backward(); opt.step()
    losses.append(l.item()); traj.append(flat(net))
traj = torch.stack(traj).numpy()
final = traj[-1]
D = traj - final
# PCA directions of the trajectory (centred on the final weights, as in Li et al.)
U, S, Vt = np.linalg.svd(D, full_matrices=False)
d1, d2 = Vt[0], Vt[1]
print("explained variance of top 2:", (S[:2]**2).sum() / (S**2).sum())
coords = D @ np.stack([d1, d2]).T  # (steps, 2)

# grid
pad = 0.35
x0, x1 = coords[:, 0].min(), coords[:, 0].max(); y0, y1 = coords[:, 1].min(), coords[:, 1].max()
w, h = x1 - x0, y1 - y0; side = max(w, h) * (1 + 2 * pad)
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
N = 129
xs = np.linspace(cx - side / 2, cx + side / 2, N); ys = np.linspace(cy - side / 2, cy + side / 2, N)
probe = make(); Z = np.zeros((N, N))
with torch.no_grad():
    for j, b in enumerate(ys):
        for i, a in enumerate(xs):
            set_flat(probe, torch.tensor(final + a * d1 + b * d2, dtype=torch.float32))
            Z[j, i] = lossf(probe(X), y).item()
print("loss grid range", Z.min(), Z.max(), "train loss start/end", losses[0], losses[-1])

# 27 waypoints, log-spaced in steps (13 basic, 14 advanced)
idx = np.unique(np.round(np.geomspace(1, STEPS, 27)).astype(int))
fig, ax = plt.subplots(1, 2, figsize=(14, 7))
Zl = np.log(Z)
ax[0].contourf(xs, ys, Zl, 40, cmap="terrain"); ax[0].contour(xs, ys, Zl, 40, colors="k", linewidths=0.4)
ax[0].plot(coords[:, 0], coords[:, 1], "r-", lw=1)
ax[0].scatter(coords[idx, 0], coords[idx, 1], c=["#c00"] * 13 + ["#00c"] * (len(idx) - 13), s=18, zorder=3)
ax[0].set_title("log loss, PCA plane of the trajectory")
ax[1].semilogy(losses); ax[1].scatter(idx, [losses[i - 1] for i in idx], c="r", s=10); ax[1].set_title("training loss")
plt.savefig(out + "/spike_contours.png", dpi=80)

fig = plt.figure(figsize=(10, 8)); a3 = fig.add_subplot(projection="3d")
XX, YY = np.meshgrid(xs, ys)
a3.plot_surface(XX, YY, Zl, cmap="terrain", linewidth=0, antialiased=True, rstride=1, cstride=1)
a3.view_init(elev=38, azim=-60)
plt.savefig(out + "/spike_3d.png", dpi=80)
np.save(out + "/Z.npy", Z)

# compact export for the design-system specimen chart
stride = 10
with open(out + "/spike_terrain.js", "w") as f:
    f.write("window.SPIKE_TERRAIN = " + json.dumps({
        "n": N, "x": [float(xs[0]), float(xs[-1])], "y": [float(ys[0]), float(ys[-1])],
        "logLoss": [round(float(v), 4) for v in np.log(Z).ravel()],
        "trail": [[round(float(a), 3), round(float(b), 3)] for a, b in coords[::stride]],
        "trailLoss": [round(losses[min(i, STEPS - 1)], 4) for i in range(0, STEPS + 1, stride)],
        "explained": round(float((S[:2]**2).sum() / (S**2).sum()), 4),
    }) + ";\n")
