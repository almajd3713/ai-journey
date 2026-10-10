"""A small GPT and its training loop, exported from the Session 3 notebook so later sessions can import them."""
import math
from dataclasses import dataclass
import torch, torch.nn as nn, torch.nn.functional as F

@dataclass
class Config:
    vocab: int = 2048
    ctx: int = 256
    d: int = 384
    layers: int = 6
    heads: int = 6
    pre_norm: bool = True

class Block(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.c = c
        self.ln1, self.ln2 = nn.LayerNorm(c.d), nn.LayerNorm(c.d)
        self.qkv, self.proj = nn.Linear(c.d, 3 * c.d), nn.Linear(c.d, c.d)
        self.fc, self.out = nn.Linear(c.d, 4 * c.d), nn.Linear(4 * c.d, c.d)

    def attn(self, x):
        B, T, D = x.shape
        q, k, v = [t.view(B, T, self.c.heads, -1).transpose(1, 2) for t in self.qkv(x).split(D, -1)]
        return self.proj(F.scaled_dot_product_attention(q, k, v, is_causal=True).transpose(1, 2).reshape(B, T, D))

    def mlp(self, x): return self.out(F.gelu(self.fc(x), approximate="tanh"))

    def forward(self, x):
        if self.c.pre_norm:
            x = x + self.attn(self.ln1(x))
            return x + self.mlp(self.ln2(x))
        x = self.ln1(x + self.attn(x))
        return self.ln2(x + self.mlp(x))

class GPT(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.c = c
        self.wte, self.wpe = nn.Embedding(c.vocab, c.d), nn.Embedding(c.ctx, c.d)
        self.blocks = nn.ModuleList([Block(c) for _ in range(c.layers)])
        self.ln_f = nn.LayerNorm(c.d)
        self.apply(self._init)
        for b in self.blocks:                        # damp the layers that write into the residual stream
            for m in (b.proj, b.out): nn.init.normal_(m.weight, std=0.02 / math.sqrt(2 * c.layers))

    @staticmethod
    def _init(m):
        if isinstance(m, (nn.Linear, nn.Embedding)): nn.init.normal_(m.weight, std=0.02)
        if isinstance(m, nn.Linear): nn.init.zeros_(m.bias)

    def forward(self, idx, targets=None):
        x = self.wte(idx) + self.wpe(torch.arange(idx.shape[1], device=idx.device))
        for b in self.blocks: x = b(x)
        if self.c.pre_norm: x = self.ln_f(x)
        logits = x @ self.wte.weight.T               # the output layer reuses the embedding table
        loss = None if targets is None else F.cross_entropy(logits.float().reshape(-1, logits.shape[-1]), targets.reshape(-1))
        return logits, loss

    @torch.no_grad()
    def generate(self, idx, n, temperature=1.0, top_k=None, top_p=None, greedy=False, generator=None):
        for _ in range(n):
            logits = self(idx[:, -self.c.ctx:])[0][:, -1].float()
            if greedy: nxt = logits.argmax(-1, keepdim=True)
            else:
                logits = logits / temperature
                if top_k: logits[logits < logits.topk(top_k).values[:, -1:]] = -float("inf")
                if top_p:
                    probs, order = logits.softmax(-1).sort(-1, descending=True)
                    drop = probs.cumsum(-1) - probs > top_p          # keep the smallest set of tokens whose probability reaches top_p
                    logits[drop.scatter(1, order, drop)] = -float("inf")
                nxt = torch.multinomial(logits.softmax(-1), 1, generator=generator)
            idx = torch.cat([idx, nxt], 1)
        return idx

import time
import numpy as np

def window_batch(data, starts, ctx):
    rows = starts.to(data.device)[:, None] + torch.arange(ctx + 1, device=data.device)
    chunk = data[rows].long()
    return chunk[:, :-1], chunk[:, 1:]                 # the target at each position is the next token

def get_batch(data, batch, ctx):
    return window_batch(data, torch.randint(0, len(data) - ctx - 1, (batch,)), ctx)

@torch.no_grad()
def evaluate(model, data, batches=40, batch=64):
    model.eval(); g = torch.Generator().manual_seed(123); losses = []
    for _ in range(batches):
        x, y = window_batch(data, torch.randint(0, len(data) - model.c.ctx - 1, (batch,), generator=g), model.c.ctx)
        with torch.autocast("cuda", dtype=torch.bfloat16, enabled=x.is_cuda): losses.append(model(x, y)[1].item())
    model.train(); return float(np.mean(losses))

def lr_at(step, steps, peak, warmup, floor=0.1):
    if step < warmup: return peak * (step + 1) / warmup                                    # linear warm-up
    return peak * (floor + (1 - floor) * 0.5 * (1 + math.cos(math.pi * (step - warmup) / max(1, steps - warmup))))   # cosine decay to 10%

def train(model, train_data, val_data, steps, peak_lr=1e-3, warmup=100, clip=1.0, batch=64, eval_every=250, seed=0, on_eval=None, weight_decay=0.1):
    """AdamW with warm-up, cosine decay and gradient clipping. Returns one record per logged step."""
    torch.manual_seed(seed); model.train()
    decay = [p for p in model.parameters() if p.dim() >= 2]; other = [p for p in model.parameters() if p.dim() < 2]
    opt = torch.optim.AdamW([{"params": decay, "weight_decay": weight_decay}, {"params": other, "weight_decay": 0.0}], lr=peak_lr, betas=(0.9, 0.95))
    log, t0 = [], time.time()
    for step in range(steps + 1):
        lr = lr_at(step, steps, peak_lr, warmup)
        for g in opt.param_groups: g["lr"] = lr
        x, y = get_batch(train_data, batch, model.c.ctx)
        with torch.autocast("cuda", dtype=torch.bfloat16, enabled=x.is_cuda): loss = model(x, y)[1]
        opt.zero_grad(set_to_none=True); loss.backward()
        gnorm = torch.nn.utils.clip_grad_norm_(model.parameters(), clip if clip else float("inf")).item()
        if step < steps: opt.step()
        rec = {"step": step}
        if step % 10 == 0: rec.update(train_loss=loss.item(), grad_norm=gnorm, lr=lr)
        if step % eval_every == 0 or step == steps:
            rec.update(val_loss=evaluate(model, val_data), seconds=time.time() - t0)
            if on_eval: on_eval(step, model)
        if len(rec) > 1: log.append(rec)
    return log
